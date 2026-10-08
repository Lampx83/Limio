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
  status: "submitted" | "graded";
  score: number | null;
  maxScore: number;
  submittedAt: string;
  gradedAt: string | null;
  pinned: boolean;
  note: string | null;
};

type Course = { courseId: string; title: string; certNumber: string; issuedAt: string; pinned: boolean };

type Settings = { slug: string; isPublic: boolean; headline: string; about: string };

const NOTE_MAX = 500;
const ABOUT_MAX = 500;

const ERRORS: Record<string, string> = {
  slug_invalid: "Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang (3–40 ký tự).",
  slug_taken: "Đường dẫn này đã có người dùng.",
  course_not_completed: "Bạn cần hoàn thành khoá học này trước.",
  group_full: "Mỗi khoá chỉ khoe được số bài tối đa cho phép. Bỏ một bài để chọn bài khác.",
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

export default function PortfolioEditor({
  initial,
  rows: initialRows,
  courses: initialCourses,
  maxPerGroup,
}: {
  initial: Settings;
  rows: Row[];
  courses: Course[];
  /** Trần bài khoe mỗi khoá — server là nguồn sự thật, UI chỉ phản chiếu. */
  maxPerGroup: number;
}) {
  const [settings, setSettings] = useState(initial);
  const [headline, setHeadline] = useState(initial.headline);
  const [about, setAbout] = useState(initial.about);
  const [courses, setCourses] = useState(initialCourses);
  const [slugDraft, setSlugDraft] = useState<string | null>(null);
  const [rows, setRows] = useState(initialRows);
  const [busy, setBusy] = useState(false);

  const publicUrl =
    typeof window === "undefined" ? `/p/${settings.slug}` : `${window.location.origin}/p/${settings.slug}`;
  const pinnedCount = rows.filter((r) => r.pinned).length;

  const rowsByGroup = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows) m.set(r.groupKey, [...(m.get(r.groupKey) ?? []), r]);
    return m;
  }, [rows]);
  const courseKeys = new Set(courses.map((c) => `course:${c.courseId}`));
  const otherGroups = useMemo(
    () => [...rowsByGroup.entries()].filter(([key]) => !courseKeys.has(key)),
    // courseKeys đổi theo `courses`, không đổi khi chỉ bật/tắt khoe khoá.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rowsByGroup, courses.length],
  );

  async function saveSettings(patch: Partial<Settings>) {
    setBusy(true);
    try {
      const r = await send("/api/me/portfolio", "PATCH", patch);
      setSettings({ slug: r.slug, isPublic: r.isPublic, headline: r.headline ?? "", about: r.about ?? "" });
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggleCourse(course: Course) {
    const url = `/api/me/portfolio/courses/${course.courseId}`;
    try {
      await send(url, course.pinned ? "DELETE" : "PUT");
      setCourses((cs) => cs.map((c) => (c.courseId === course.courseId ? { ...c, pinned: !course.pinned } : c)));
    } catch (e) {
      toast.error((e as Error).message);
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
          </div>
          <label className="text-meta mt-3 block" htmlFor="pf-about">
            Giới thiệu ngắn (tuỳ chọn)
          </label>
          <textarea
            id="pf-about"
            className="textarea mt-1 text-sm"
            rows={3}
            maxLength={ABOUT_MAX}
            placeholder="Vài câu về bạn: bạn thích làm gì, đang tìm cơ hội nào?"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-caption">
              {about.length}/{ABOUT_MAX}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy || (headline === settings.headline && about === settings.about)}
              onClick={async () => {
                if (await saveSettings({ headline, about })) toast.success("Đã lưu");
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
          Khoá học và sản phẩm <span className="text-meta font-normal">· đã chọn {pinnedCount} bài</span>
        </h2>
        <p className="text-meta mt-1">
          Tick khoá bạn muốn khoe (kèm giấy chứng nhận), rồi chọn tối đa {maxPerGroup} bài tiêu biểu trong khoá đó. Bài của
          khoá chưa tick sẽ không hiện ra ngoài.
        </p>
        {courses.length === 0 && otherGroups.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon="🗂️"
            title="Chưa có khoá nào hoàn thành"
            description="Khi hoàn thành 100% một khoá học, bạn nhận giấy chứng nhận và khoe khoá đó cùng bài làm ở đây."
          />
        ) : (
          <>
            {courses.map((c) => (
              <GroupSection
                key={c.courseId}
                title={c.title}
                subtitle={`Hoàn thành ${formatDate(c.issuedAt)} · Chứng nhận ${c.certNumber}`}
                course={c}
                onToggleCourse={() => toggleCourse(c)}
                rows={rowsByGroup.get(`course:${c.courseId}`) ?? []}
                maxPerGroup={maxPerGroup}
                onTogglePin={togglePin}
                onSaveNote={saveNote}
              />
            ))}
            {otherGroups.map(([key, groupRows]) => (
              <GroupSection
                key={key}
                title={groupRows[0]!.groupTitle}
                rows={groupRows}
                maxPerGroup={maxPerGroup}
                onTogglePin={togglePin}
                onSaveNote={saveNote}
              />
            ))}
          </>
        )}
      </section>
    </>
  );
}

function GroupSection({
  title,
  subtitle,
  course,
  onToggleCourse,
  rows,
  maxPerGroup,
  onTogglePin,
  onSaveNote,
}: {
  title: string;
  subtitle?: string;
  course?: Course;
  onToggleCourse?: () => Promise<void>;
  rows: Row[];
  maxPerGroup: number;
  onTogglePin: (row: Row) => Promise<void>;
  onSaveNote: (row: Row, note: string) => Promise<void>;
}) {
  const pinned = rows.filter((r) => r.pinned).length;
  const full = pinned >= maxPerGroup;
  const hidden = course && !course.pinned;
  return (
    <div className="card mt-4 p-3 sm:p-4">
      {course ? (
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 accent-brand-600"
            checked={course.pinned}
            onChange={() => void onToggleCourse?.()}
          />
          <span className="min-w-0 flex-1">
            <span className="text-h4 block break-words">{title}</span>
            <span className="text-caption">{subtitle}</span>
          </span>
          <span className={course.pinned ? "chip-success" : "chip"}>{course.pinned ? "Đang khoe" : "Đang ẩn"}</span>
        </label>
      ) : (
        <h3 className="text-h4">{title}</h3>
      )}
      {rows.length > 0 && (
        <div className={`mt-3 ${hidden ? "opacity-60" : ""}`}>
          <p className={`text-caption mb-2 ${full ? "font-semibold text-brand-700" : ""}`}>
            {full
              ? `Đã chọn đủ ${pinned}/${maxPerGroup} bài. Bỏ một bài để chọn bài khác.`
              : `Đã chọn ${pinned}/${maxPerGroup} bài`}
            {hidden && " · Bài chỉ hiện ra ngoài khi bạn khoe khoá này."}
          </p>
          <ul className="space-y-2">
            {rows.map((r) => (
              <PortfolioRow
                key={r.submissionId}
                row={r}
                locked={full && !r.pinned}
                onToggle={() => onTogglePin(r)}
                onSaveNote={(n) => onSaveNote(r, n)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PortfolioRow({
  row,
  locked,
  onToggle,
  onSaveNote,
}: {
  row: Row;
  /** Khoá đã đủ trần: ô chưa tick không bấm được, ô đã tick vẫn bỏ được. */
  locked: boolean;
  onToggle: () => Promise<void>;
  onSaveNote: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState(row.note ?? "");
  const [pending, setPending] = useState(false);

  return (
    <li
      className={`card p-3 sm:p-4 ${row.pinned ? "border-brand-300" : ""} ${locked ? "opacity-50" : ""}`}
      title={locked ? "Đã đủ số bài cho khoá này. Bỏ một bài để chọn bài này." : undefined}
    >
      <label className={`flex items-start gap-3 ${locked ? "cursor-not-allowed" : "cursor-pointer"}`}>
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 accent-brand-600"
          checked={row.pinned}
          disabled={pending || locked}
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
            {row.status === "graded" && row.gradedAt ? (
              <>Chấm ngày {formatDate(row.gradedAt)} · </>
            ) : (
              <>Nộp ngày {formatDate(row.submittedAt)} · chưa chấm</>
            )}
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
