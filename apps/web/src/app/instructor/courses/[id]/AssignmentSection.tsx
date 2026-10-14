"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ClipboardList, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { formatDateTime, fromDateTimeInputValue, toDateTimeInputValue } from "@/lib/datetime";
import SectionDeadlinesPanel, {
  type Schedule,
  type SectionDeadlinesHandle,
} from "@/components/instructor/SectionDeadlinesPanel";
import { plainToRichHtml } from "@/lib/richText";
import SafeHtml from "@/components/SafeHtml";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});
import {
  GENERATIVE_PRESETS,
  type GenerativeActivityType,
} from "@/lib/generativeActivity";
import GenerativeTypePicker from "@/components/GenerativeTypePicker";
import SubmissionModeField, { type SubmissionMode } from "./SubmissionModeField";

interface Assignment {
  id: string;
  title: string;
  description: string;
  dueAt: Date | null;
  maxScore: number;
  isHidden: boolean;
  pedagogicalIntent?: GenerativeActivityType | null;
  requireSelfRating?: boolean;
  requireReflection?: boolean;
  countsTowardGrade?: boolean;
  rubricText?: string | null;
  submissionMode?: SubmissionMode;
}

export default function AssignmentSection({
  assignment,
  showResearch = false,
}: {
  assignment: Assignment;
  /** Role Researcher: mới thấy hai ô yêu cầu tự đánh giá / nhận xét. */
  showResearch?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(assignment.title);
  const [description, setDescription] = useState(plainToRichHtml(assignment.description));
  // datetime-local không mang múi giờ: đổ/đọc bằng giờ Việt Nam (cắt ISO UTC làm lệch 7 tiếng mỗi lần sửa).
  const [schedule, setSchedule] = useState<Schedule>({
    opensEnabled: false,
    opensLocal: "",
    dueEnabled: !!assignment.dueAt,
    dueLocal: assignment.dueAt ? toDateTimeInputValue(assignment.dueAt) : "",
  });
  const [error, setError] = useState<string | null>(null);
  const sectionsRef = useRef<SectionDeadlinesHandle>(null);
  const [maxScore, setMaxScore] = useState(String(assignment.maxScore));
  const [isHidden, setIsHidden] = useState(assignment.isHidden);
  const [pedagogicalIntent, setPedagogicalIntent] = useState<
    GenerativeActivityType | ""
  >(assignment.pedagogicalIntent ?? "");
  const [requireSelfRating, setRequireSelfRating] = useState(
    assignment.requireSelfRating ?? false,
  );
  const [requireReflection, setRequireReflection] = useState(
    assignment.requireReflection ?? false,
  );
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>(
    assignment.submissionMode ?? "individual",
  );
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const dueAt = schedule.dueEnabled ? fromDateTimeInputValue(schedule.dueLocal) : null;
    const sectionError = sectionsRef.current?.validate();
    if (sectionError) {
      setError(sectionError);
      return;
    }
    setBusy(true);
    const payload: Record<string, unknown> = {
      title,
      description,
      maxScore: Number(maxScore) || 100,
      pedagogicalIntent: pedagogicalIntent || null,
      requireSelfRating,
      requireReflection,
    };
    // Chỉ gửi khi GV thực sự đổi — tránh lần lưu khác bị chặn vì "đã có bài nộp".
    if (submissionMode !== (assignment.submissionMode ?? "individual")) {
      payload.submissionMode = submissionMode;
    }
    if (pedagogicalIntent) {
      payload.responseFormat =
        GENERATIVE_PRESETS[pedagogicalIntent].responseFormat;
    }
    payload.dueAt = dueAt;
    const res = await fetch(apiUrl(`/api/assignments/${assignment.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setBusy(false);
      const d = (await res.json().catch(() => ({}))) as { details?: unknown };
      setError(
        d.details === "submission_mode_locked"
          ? "Không đổi được cách nộp vì đã có bài nộp."
          : "Chưa lưu được bài tập. Kiểm tra rồi thử lại.",
      );
      return;
    }
    // Hạn riêng từng lớp lưu tiếp ngay sau đó (cùng một lần bấm Lưu).
    const sectionsOk = (await sectionsRef.current?.save()) ?? true;
    setBusy(false);
    router.refresh();
    if (!sectionsOk) {
      setError("Đã lưu bài tập nhưng chưa lưu được hạn riêng của các lớp. Kiểm tra rồi bấm Lưu lại.");
      return;
    }
    setEditing(false);
  }

  async function toggleHidden() {
    const next = !isHidden;
    setIsHidden(next);
    await fetch(apiUrl(`/api/assignments/${assignment.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHidden: next }),
    });
    router.refresh();
  }

  async function remove() {
    if (!confirm("Xóa assignment này?")) return;
    setBusy(true);
    const res = await fetch(apiUrl(`/api/assignments/${assignment.id}`), {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className={`group/as rounded-xl border-2 p-4 transition-colors ${
      isHidden
        ? 'border-danger-200 bg-danger-50/50'
        : 'border-token bg-[rgb(var(--surface))]'
    }`}>
      {!editing ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-pink-100 text-pink-700">
                <ClipboardList className="h-4 w-4" aria-hidden />
              </span>
              <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip bg-pink-100 text-pink-700">Assignment</span>
                {assignment.pedagogicalIntent && (
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-700">
                    {GENERATIVE_PRESETS[assignment.pedagogicalIntent].label}
                  </span>
                )}
                {assignment.submissionMode === "team" && (
                  <span className="chip bg-sky-100 text-sky-700">Nộp theo nhóm</span>
                )}
                {isHidden && <span className="chip-danger text-xs">👁️ Ẩn</span>}
              </div>
              <p className="mt-1 text-base font-semibold">{assignment.title}</p>
              {assignment.description && (
                <SafeHtml
                  html={plainToRichHtml(assignment.description)}
                  className="prose prose-sm mt-2 max-w-none text-muted dark:prose-invert"
                />
              )}
              </div>
            </div>
            <span className="shrink-0 text-right text-sm text-muted">
              <div className="font-semibold text-base">{assignment.maxScore}đ</div>
              {assignment.dueAt && (
                <div className="text-xs text-faint mt-1">
                  {formatDateTime(assignment.dueAt)}
                </div>
              )}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href={`/instructor/assignments/${assignment.id}/submissions`}
              className="btn-secondary btn-sm"
            >
              Xem bài nộp
            </Link>
            <div className="ml-auto flex items-center gap-1 rounded-lg p-0.5 opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-lg:opacity-100 opacity-60 transition-opacity group-hover/as:opacity-100">
              <button
                type="button"
                onClick={toggleHidden}
                className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                  isHidden
                    ? "bg-danger-50 text-danger-600 hover:bg-danger-100"
                    : "text-faint hover:bg-brand-soft hover:text-brand-600"
                }`}
                title={isHidden ? "Đang ẩn — bấm để hiện" : "Đang hiện — bấm để ẩn"}
                aria-label={isHidden ? "Hiện assignment" : "Ẩn assignment"}
                aria-pressed={isHidden}
              >
                {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-faint transition-colors hover:bg-brand-soft hover:text-brand-600"
                title="Sửa assignment"
                aria-label="Sửa"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                title="Xóa assignment"
                aria-label="Xóa"
                className="flex h-8 w-8 items-center justify-center rounded-md text-faint transition-colors hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <form onSubmit={save} className="space-y-2">
          <div>
            <span className="text-xs text-faint">Dạng bài làm (không bắt buộc)</span>
            <div className="mt-1">
              <GenerativeTypePicker
                value={pedagogicalIntent}
                onChange={setPedagogicalIntent}
              />
            </div>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="input"
          />
          <RichTextEditor value={description} onChange={setDescription} />
          {showResearch && (
            <fieldset className="grid grid-cols-1 gap-1 rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-2 text-xs sm:grid-cols-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={requireSelfRating}
                  onChange={(e) => setRequireSelfRating(e.target.checked)}
                />
                Yêu cầu học viên tự đánh giá bài làm (1–5)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={requireReflection}
                  onChange={(e) => setRequireReflection(e.target.checked)}
                />
                Yêu cầu học viên viết nhận xét sau khi làm (tối thiểu 20 ký tự)
              </label>
            </fieldset>
          )}
          <label className="flex items-center gap-2 text-xs text-muted">
            Điểm tối đa
            <input
              type="number"
              min={1}
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              className="input h-8 w-24"
            />
          </label>
          <SubmissionModeField
            name={`submission-mode-${assignment.id}`}
            value={submissionMode}
            onChange={setSubmissionMode}
          />
          <SectionDeadlinesPanel
            ref={sectionsRef}
            kind="assignment"
            itemId={assignment.id}
            base={schedule}
            onBaseChange={setSchedule}
          />
          {error && (
            <p role="alert" className="banner-danger text-sm">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary btn-sm">
              Lưu
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn-secondary btn-sm"
            >
              Hủy
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
