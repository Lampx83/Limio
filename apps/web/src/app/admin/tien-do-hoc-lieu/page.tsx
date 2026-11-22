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
  rows: { label: string; sub?: string; cells: Record<string, Cell> }[];
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

function Dot({ s, title }: { s: StageState; title?: string }) {
  const cls =
    s === "done"
      ? "bg-emerald-500"
      : s === "partial"
        ? "bg-amber-400"
        : s === "na"
          ? "bg-transparent border border-token"
          : "bg-[rgb(var(--surface-muted))] border border-token";
  const label = s === "done" ? "Xong" : s === "partial" ? "Đang làm" : s === "na" ? "Không áp dụng" : "Chưa làm";
  return <span title={title ? `${label}: ${title}` : label} className={`inline-block h-3 w-3 rounded-full align-middle ${cls}`} />;
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
    <main className="mx-auto max-w-6xl space-y-12 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-h1">Tiến độ học liệu</h1>
        <p className="mt-1 text-meta">
          Theo dõi việc sinh học liệu cho từng môn/khoá. Số liệu do script vận hành của từng dự án đẩy lên sau mỗi đợt làm việc, không phải số đo tức thời.
        </p>
      </div>

      {projects.length === 0 && (
        <div className="banner-info">Chưa có dự án nào đẩy tiến độ lên.</div>
      )}

      {projects.map((p) => (
        <section key={p.id} id={p.id} className="space-y-6">
          <div className="border-b border-token pb-3">
            <h2 className="text-h2">{p.title}</h2>
            {p.subtitle && <p className="text-meta mt-0.5">{p.subtitle}</p>}
            <p className="text-caption mt-1">
              Cập nhật lúc {formatDateTime(new Date(p.updatedAt))}
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {p.stats.map((s) => (
                <div key={s.label} className="rounded-lg border border-token p-4">
                  <div className="text-caption">{s.label}</div>
                  <div className="text-h2">{s.value}</div>
                  {s.hint && <div className="text-caption">{s.hint}</div>}
                </div>
              ))}
            </div>
          )}

          {p.reports && p.reports.length > 0 && (
            <div>
              <h3 className="text-h3">Báo cáo việc sinh học liệu</h3>
              <ul className="mt-2 space-y-2">
                {p.reports.slice(0, 12).map((r) => (
                  <li key={r.at + r.title} className="rounded-lg border border-token p-3 text-sm">
                    <div className="text-caption">{formatDateTime(new Date(r.at))}</div>
                    <div className="font-semibold">{r.title}</div>
                    {r.body && <div className="mt-0.5 whitespace-pre-line text-muted">{r.body}</div>}
                  </li>
                ))}
              </ul>
              {p.reports.length > 12 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-caption">Xem thêm {p.reports.length - 12} báo cáo cũ hơn</summary>
                  <ul className="mt-2 space-y-2">
                    {p.reports.slice(12).map((r) => (
                      <li key={r.at + r.title} className="rounded-lg border border-token p-3 text-sm">
                        <div className="text-caption">{formatDateTime(new Date(r.at))}</div>
                        <div className="font-semibold">{r.title}</div>
                        {r.body && <div className="mt-0.5 whitespace-pre-line text-muted">{r.body}</div>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {p.pipelines && p.pipelines.length > 0 && (
            <div>
              <h3 className="text-h3">Đang chạy</h3>
              <ul className="mt-2 space-y-2">
                {p.pipelines.map((x) => (
                  <li key={x.name} className="rounded-lg border border-token p-3 text-sm">
                    <span className="font-semibold">{x.name}</span> — {x.status}
                    {x.note && <div className="text-caption mt-0.5">{x.note}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {p.forecast && (
            <div>
              <h3 className="text-h3">Dự báo hoàn thành</h3>
              <div className="banner-info mt-2 whitespace-pre-line text-sm">{p.forecast.text}</div>
              {p.forecast.assumptions && (
                <ul className="mt-2 list-disc pl-5 text-caption">
                  {p.forecast.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {p.groups?.map((g) => {
            const table = (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-caption">
                    <tr className="border-b border-token">
                      <th className="px-3 py-2">&nbsp;</th>
                      {g.columns.map((c) => (
                        <th key={c.key} className="px-3 py-2 text-center">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.label} className="border-b border-token">
                        <td className="px-3 py-2">
                          <span className="font-medium">{r.label}</span>
                          {r.sub && <span className="text-muted"> · {r.sub}</span>}
                        </td>
                        {g.columns.map((c) => (
                          <td key={c.key} className="px-3 py-2 text-center">
                            <Dot s={r.cells[c.key]?.state ?? "todo"} title={r.cells[c.key]?.detail} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
            return g.collapsed ? (
              <details key={g.id}>
                <summary className="text-h3 cursor-pointer">{g.title}</summary>
                {g.note && <p className="text-caption mt-0.5">{g.note}</p>}
                {table}
              </details>
            ) : (
              <div key={g.id}>
                <h3 className="text-h3">{g.title}</h3>
                {g.note && <p className="text-caption mt-0.5">{g.note}</p>}
                {table}
              </div>
            );
          })}

          {p.groups && p.groups.length > 0 && (
            <p className="text-caption">
              <Dot s="done" /> xong &nbsp; <Dot s="partial" /> đang làm &nbsp; <Dot s="todo" /> chưa làm &nbsp; <Dot s="na" /> không áp dụng. Rê chuột vào chấm để xem chi tiết.
            </p>
          )}

          {p.notes && p.notes.length > 0 && (
            <div>
              <h3 className="text-h3">Ghi chú</h3>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {p.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}
    </main>
  );
}
