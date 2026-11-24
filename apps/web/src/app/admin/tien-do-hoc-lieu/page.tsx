import { redirect } from "next/navigation";
import { isAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { getRedis } from "@/lib/redis";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tiến độ học liệu" };

/**
 * Mỗi môn/khoá đang được sinh học liệu là một "dự án", tự đẩy bảng tiến độ của mình lên Redis
 * (khoá `ops:content-progress:<mã dự án>`, giá trị JSON kiểu `Project` dưới đây) bằng script vận hành.
 * Trang này chỉ hiển thị, không biết gì riêng về môn nào. Xem docs/van-hanh/tien-do-hoc-lieu.md.
 */
const KEY_PREFIX = "ops:content-progress:";

type StageState = "done" | "partial" | "todo" | "na";
type Cell = { state: StageState; detail?: string };
type Group = {
  id: string;
  title: string;
  note?: string;
  /** Gập lại mặc định (bảng dài). */
  collapsed?: boolean;
  columns: { key: string; label: string }[];
  rows: { label: string; sub?: string; cells: Record<string, Cell>; links?: { label: string; href: string }[] }[];
};
type Project = {
  id: string;
  title: string;
  subtitle?: string;
  updatedAt: string;
  link?: { label: string; href: string };
  stats?: { label: string; value: string; hint?: string }[];
  pipelines?: { name: string; status: string; note?: string }[];
  forecast?: { text: string; assumptions?: string[] };
  groups?: Group[];
  /** Báo cáo việc sinh học liệu, mới nhất trước. */
  reports?: { at: string; title: string; body?: string }[];
  notes?: string[];
};

const STATE_LABEL: Record<StageState, string> = { done: "Xong", partial: "Đang làm", todo: "Chưa làm", na: "Không áp dụng" };
const STATE_CLS: Record<StageState, string> = {
  done: "bg-emerald-500",
  partial: "bg-amber-400",
  todo: "bg-[rgb(var(--surface-muted))] border border-token",
  na: "border border-dashed border-token opacity-60",
};

function Dot({ s, title, size = "h-3 w-3" }: { s: StageState; title?: string; size?: string }) {
  return <span title={title ? `${STATE_LABEL[s]}: ${title}` : STATE_LABEL[s]} className={`inline-block rounded-full align-middle ${size} ${STATE_CLS[s]}`} />;
}

function timeAgo(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  if (m < 60 * 24) return `${Math.round(m / 60)} giờ trước`;
  return `${Math.round(m / 1440)} ngày trước`;
}

/** Tỉ lệ ô "xong" trên các ô áp dụng của một bảng. */
function groupProgress(g: Group) {
  let done = 0;
  let partial = 0;
  let total = 0;
  for (const r of g.rows)
    for (const c of g.columns) {
      const st = r.cells[c.key]?.state ?? "todo";
      if (st === "na") continue;
      total++;
      if (st === "done") done++;
      else if (st === "partial") partial++;
    }
  return { done, partial, total, pct: total ? Math.round((100 * done) / total) : 0 };
}

function ProgressBar({ done, partial, total }: { done: number; partial: number; total: number }) {
  if (!total) return null;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]" role="img" aria-label={`${done} xong, ${partial} đang làm, trên ${total}`}>
      <div className="bg-emerald-500" style={{ width: `${(100 * done) / total}%` }} />
      <div className="bg-amber-400" style={{ width: `${(100 * partial) / total}%` }} />
    </div>
  );
}

/** Bản đồ nhiệt: hàng = công đoạn, cột = từng Chủ đề; mỗi ô là một chấm có chú thích khi rê chuột. */
function Heatmap({ g }: { g: Group }) {
  const num = (label: string) => label.match(/^\d+/)?.[0] ?? label.slice(0, 3);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]" style={{ display: "grid", gridTemplateColumns: `7.5rem repeat(${g.rows.length}, minmax(0, 1fr)) 3rem`, rowGap: "0.35rem", alignItems: "center" }}>
        <div />
        {g.rows.map((r) => {
          const href = r.links?.[0]?.href;
          const review = (r.sub ?? "").includes("bài ôn");
          const t = `${r.label}${r.sub ? " · " + r.sub : ""}`;
          return (
            <div key={r.label} className={`text-center text-[11px] tabular-nums ${review ? "font-semibold text-muted" : "text-muted"}`} title={t}>
              {href ? (
                <a href={href} target="_blank" rel="noopener" className="link">
                  {num(r.label)}
                </a>
              ) : (
                num(r.label)
              )}
            </div>
          );
        })}
        <div />
        {g.columns.map((c) => {
          const n = g.rows.filter((r) => r.cells[c.key]?.state === "done").length;
          const app = g.rows.filter((r) => (r.cells[c.key]?.state ?? "todo") !== "na").length;
          return (
            <div key={c.key} className="contents">
              <div className="pr-2 text-xs leading-tight">{c.label}</div>
              {g.rows.map((r) => {
                const cell = r.cells[c.key];
                return (
                  <div key={r.label} className="flex justify-center">
                    <Dot s={cell?.state ?? "todo"} size="h-4 w-4" title={`${r.label} · ${c.label}${cell?.detail ? " — " + cell.detail : ""}`} />
                  </div>
                );
              })}
              <div className="text-right text-[11px] tabular-nums text-muted">
                {n}/{app}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SmallTable({ g }: { g: Group }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-left text-caption">
          <tr className="border-b border-token">
            <th className="py-1.5 pr-2">&nbsp;</th>
            {g.columns.map((c) => (
              <th key={c.key} className="px-1.5 py-1.5 text-center font-normal">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {g.rows.map((r) => (
            <tr key={r.label} className="border-b border-token">
              <td className="py-1.5 pr-2 font-medium">
                {r.links?.[0]?.href ? (
                  <a href={r.links[0].href} className="link" target="_blank" rel="noopener">
                    {r.label}
                  </a>
                ) : (
                  r.label
                )}
              </td>
              {g.columns.map((c) => (
                <td key={c.key} className="px-1.5 py-1.5 text-center">
                  <Dot s={r.cells[c.key]?.state ?? "todo"} title={r.cells[c.key]?.detail} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function pillCls(status: string): string {
  const s = status.toLowerCase();
  if (/(chặn|lỗi|hết hạn)/.test(s)) return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
  if (/(đang|chạy)/.test(s)) return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
  if (/(xong|đã lên|đã ghép)/.test(s)) return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
  return "bg-[rgb(var(--surface-muted))] text-muted";
}

async function loadProjects(): Promise<Project[]> {
  try {
    const redis = getRedis();
    const keys: string[] = [];
    let cursor = "0";
    do {
      const [next, batch] = await redis.scan(cursor, "MATCH", `${KEY_PREFIX}*`, "COUNT", 100);
      cursor = next;
      keys.push(...batch);
    } while (cursor !== "0" && keys.length < 200);
    const out: Project[] = [];
    for (const k of keys.sort()) {
      const raw = await redis.get(k);
      if (!raw) continue;
      try {
        out.push(JSON.parse(raw) as Project);
      } catch {
        /* bỏ qua bản ghi hỏng */
      }
    }
    return out;
  } catch {
    return [];
  }
}

export default async function AdminContentProgressPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin?next=/admin/tien-do-hoc-lieu");
  if (!(await isAdmin(userId))) redirect("/");

  const projects = await loadProjects();

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-5 lg:px-6">
      <div>
        <h1 className="text-h1">Tiến độ học liệu</h1>
        <p className="text-caption">
          <Dot s="done" /> xong &nbsp; <Dot s="partial" /> đang làm &nbsp; <Dot s="todo" /> chưa làm &nbsp; <Dot s="na" /> không áp dụng. Rê chuột vào chấm hoặc số Chủ đề để xem chi tiết.
        </p>
      </div>

      {projects.length === 0 && <div className="banner-info">Chưa có dự án nào đẩy tiến độ lên.</div>}

      {projects.map((p) => {
        const matrices = (p.groups ?? []).filter((g) => g.rows.length >= 8);
        const tables = (p.groups ?? []).filter((g) => g.rows.length < 8);
        return (
          <section key={p.id} id={p.id} className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-token pb-2">
              <h2 className="text-h2">{p.title}</h2>
              <p className="text-caption">
                Cập nhật {timeAgo(p.updatedAt)}
                {p.link && (
                  <>
                    {" · "}
                    <a href={p.link.href} className="link" target="_blank" rel="noopener">
                      {p.link.label}
                    </a>
                  </>
                )}
              </p>
            </div>

            {p.stats && p.stats.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {p.stats.map((s) => (
                  <div key={s.label} className="rounded-lg border border-token px-3 py-2" title={s.hint}>
                    <div className="truncate text-caption">{s.label}</div>
                    <div className="text-lg font-semibold leading-tight">{s.value}</div>
                  </div>
                ))}
              </div>
            )}

            {p.pipelines && p.pipelines.length > 0 && (
              <ul className="divide-y divide-[rgb(var(--border))] rounded-lg border border-token text-sm">
                {p.pipelines.map((x) => (
                  <li key={x.name}>
                    <details className="group">
                      <summary className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
                        <span className="font-medium">{x.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${pillCls(x.status)}`}>{x.status}</span>
                      </summary>
                      {x.note && <p className="px-3 pb-2 text-caption">{x.note}</p>}
                    </details>
                  </li>
                ))}
              </ul>
            )}

            {matrices.map((g) => {
              const pr = groupProgress(g);
              return (
                <div key={g.id} className="rounded-lg border border-token p-3">
                  <div className="mb-2 flex items-center gap-3">
                    <h3 className="text-sm font-semibold">{g.title.replace(": từng Chủ đề", "")}</h3>
                    <div className="flex-1">
                      <ProgressBar {...pr} />
                    </div>
                    <span className="text-xs tabular-nums text-muted">{pr.pct}%</span>
                  </div>
                  <Heatmap g={g} />
                </div>
              );
            })}

            {tables.map((g) => (
              <details key={g.id} className="rounded-lg border border-token p-3" open={!g.collapsed}>
                <summary className="cursor-pointer text-sm font-semibold">{g.title}</summary>
                <div className="mt-2">
                  <SmallTable g={g} />
                </div>
              </details>
            ))}

            <div className="grid gap-2 sm:grid-cols-3">
              {p.forecast && (
                <details className="rounded-lg border border-token px-3 py-2 text-sm">
                  <summary className="cursor-pointer font-medium">Dự báo</summary>
                  <div className="mt-2 whitespace-pre-line text-caption">{p.forecast.text}</div>
                  {p.forecast.assumptions && (
                    <ul className="mt-1 list-disc pl-4 text-caption">
                      {p.forecast.assumptions.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  )}
                </details>
              )}
              {p.notes && p.notes.length > 0 && (
                <details className="rounded-lg border border-token px-3 py-2 text-sm">
                  <summary className="cursor-pointer font-medium">Ghi chú ({p.notes.length})</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-caption">
                    {p.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </details>
              )}
              {p.reports && p.reports.length > 0 && (
                <details className="rounded-lg border border-token px-3 py-2 text-sm">
                  <summary className="cursor-pointer font-medium">Nhật ký giờ qua giờ</summary>
                  <ul className="mt-2 space-y-1.5 text-caption">
                    {p.reports.slice(0, 8).map((r) => (
                      <li key={r.at + r.title}>
                        <span className="tabular-nums">{formatDateTime(new Date(r.at))}</span>
                        {r.body && <span className="whitespace-pre-line"> — {r.body.replace(/\n/g, " · ")}</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </section>
        );
      })}
    </main>
  );
}
