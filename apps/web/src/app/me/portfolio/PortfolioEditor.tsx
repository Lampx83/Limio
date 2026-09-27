"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import { copyText } from "@/lib/clipboard";
import { formatDate } from "@/lib/datetime";
import { toast } from "@/lib/toast";

type Row = {
  submissionId: string;
  assignmentTitle: string;
  groupKey: string;
  groupTitle: string;
  score: number | null;
  maxScore: number;
  gradedAt: string | null;
  pinned: boolean;
  note: string | null;
};

type Settings = { slug: string; isPublic: boolean; headline: string };

const NOTE_MAX = 500;

const ERRORS: Record<string, string> = {
  slug_invalid: "Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang (3–40 ký tự).",
  slug_taken: "Đường dẫn này đã có người dùng.",
  not_graded: "Bài này chưa được chấm lại nên chưa ghim được.",
  validation_failed: "Nội dung không hợp lệ.",
};

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(ERRORS[data.error as string] ?? "Không lưu được, thử lại sau.");
  return data;
}

export default function PortfolioEditor({ initial, rows: initialRows }: { initial: Settings; rows: Row[] }) {
  const [settings, setSettings] = useState(initial);
  const [headline, setHeadline] = useState(initial.headline);
  const [slugDraft, setSlugDraft] = useState<string | null>(null);
  const [rows, setRows] = useState(initialRows);
  const [busy, setBusy] = useState(false);

  const publicUrl =
    typeof window === "undefined" ? `/p/${settings.slug}` : `${window.location.origin}/p/${settings.slug}`;
  const pinnedCount = rows.filter((r) => r.pinned).length;

  const groups = useMemo(() => {
    const m = new Map<string, { title: string; rows: Row[] }>();
    for (const r of rows) {
      const g = m.get(r.groupKey) ?? { title: r.groupTitle, rows: [] };
      g.rows.push(r);
      m.set(r.groupKey, g);
    }
    return [...m.values()];
  }, [rows]);

  async function saveSettings(patch: Partial<Settings>) {
    setBusy(true);
    try {
      const r = await send("/api/me/portfolio", "PATCH", patch);
      setSettings({ slug: r.slug, isPublic: r.isPublic, headline: r.headline ?? "" });
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function togglePin(row: Row) {
    const url = `/api/me/portfolio/items/${row.submissionId}`;
    try {
      if (row.pinned) await send(url, "DELETE");
      else await send(url, "PUT", { note: null });
      setRows((rs) =>
        rs.map((r) => (r.submissionId === row.submissionId ? { ...r, pinned: !row.pinned, note: null } : r)),
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function saveNote(row: Row, note: string) {
    try {
      await send(`/api/me/portfolio/items/${row.submissionId}`, "PUT", { note: note.trim() || null });
      setRows((rs) => rs.map((r) => (r.submissionId === row.submissionId ? { ...r, note: note.trim() || null } : r)));
      toast.success("Đã lưu câu giới thiệu");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <section className="card mt-6 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <span id="pf-public-label">
            <span className="text-h4 block">Công khai</span>
            <span className="text-meta">
              {settings.isPublic
                ? "Ai có link đều xem được. Điểm và nhận xét của giáo viên không hiện."
                : "Chỉ bạn thấy. Link công khai đang tắt."}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.isPublic}
            aria-labelledby="pf-public-label"
            disabled={busy}
            onClick={() => saveSettings({ isPublic: !settings.isPublic })}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60 ${
              settings.isPublic ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-600"
            }`}
          >
            <span
              aria-hidden
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                settings.isPublic ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>

        {settings.isPublic && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-[rgb(var(--surface-muted))] px-3 py-2 text-sm">
              {publicUrl}
            </code>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  if (await copyText(publicUrl)) toast.success("Đã sao chép link");
                }}
              >
                Sao chép link
              </button>
              <Link href={`/p/${settings.slug}`} target="_blank" className="btn btn-secondary btn-sm">
                Xem
              </Link>
            </div>
          </div>
        )}

        <div className="mt-4">
          <label className="text-meta" htmlFor="pf-headline">
            Dòng giới thiệu (tuỳ chọn)
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="pf-headline"
              className="input flex-1"
              maxLength={160}
              placeholder="Ví dụ: Sinh viên Công nghệ giáo dục, yêu thích thiết kế UI"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy || headline === settings.headline}
              onClick={async () => {
                if (await saveSettings({ headline })) toast.success("Đã lưu");
              }}
            >
              Lưu
            </button>
          </div>
        </div>

        <div className="mt-3 text-meta">
          {slugDraft === null ? (
            <>
              Đường dẫn: <span className="font-mono">/p/{settings.slug}</span>{" "}
              <button type="button" className="text-brand-600 hover:underline" onClick={() => setSlugDraft(settings.slug)}>
                Đổi
              </button>
            </>
          ) : (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await saveSettings({ slug: slugDraft })) {
                  setSlugDraft(null);
                  toast.success("Đã đổi đường dẫn. Link cũ không còn dùng được.");
                }
              }}
            >
              <span className="font-mono">/p/</span>
              <input
                className="input w-48"
                value={slugDraft}
                maxLength={40}
                onChange={(e) => setSlugDraft(e.target.value.toLowerCase())}
                autoFocus
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                Lưu
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSlugDraft(null)}>
                Huỷ
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-h3">
          Bài đã được chấm <span className="text-meta font-normal">· đã chọn {pinnedCount}</span>
        </h2>
        {rows.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon="🗂️"
            title="Chưa có bài nào được chấm"
            description="Khi giáo viên chấm bài tập của bạn, bài sẽ hiện ở đây để bạn chọn đưa vào portfolio."
          />
        ) : (
          groups.map((g) => (
            <div key={g.title} className="mt-5">
              <h3 className="text-h4">{g.title}</h3>
              <ul className="mt-2 space-y-2">
                {g.rows.map((r) => (
                  <PortfolioRow key={r.submissionId} row={r} onToggle={() => togglePin(r)} onSaveNote={(n) => saveNote(r, n)} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </>
  );
}

function PortfolioRow({
  row,
  onToggle,
  onSaveNote,
}: {
  row: Row;
  onToggle: () => Promise<void>;
  onSaveNote: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState(row.note ?? "");
  const [pending, setPending] = useState(false);

  return (
    <li className={`card p-3 sm:p-4 ${row.pinned ? "border-brand-300" : ""}`}>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 accent-brand-600"
          checked={row.pinned}
          disabled={pending}
          onChange={async () => {
            setPending(true);
            await onToggle();
            setNote("");
            setPending(false);
          }}
        />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{row.assignmentTitle}</span>
          <span className="text-caption">
            {row.gradedAt && <>Chấm ngày {formatDate(row.gradedAt)} · </>}
            {row.score != null && (
              <span title="Chỉ bạn thấy điểm">
                {row.score}/{row.maxScore} điểm (chỉ bạn thấy)
              </span>
            )}
          </span>
        </span>
      </label>
      {row.pinned && (
        <div className="mt-3 pl-7">
          <textarea
            className="textarea text-sm"
            rows={2}
            maxLength={NOTE_MAX}
            placeholder="Một câu giới thiệu bài này (tuỳ chọn): bạn đã làm gì, tự hào điều gì?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-caption">
              {note.length}/{NOTE_MAX}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={note.trim() === (row.note ?? "")}
              onClick={() => onSaveNote(note)}
            >
              Lưu
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
