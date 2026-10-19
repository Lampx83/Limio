"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, FileText, Globe, Hash, Tag, Users } from "lucide-react";
import { formatDateTime } from "@/lib/datetime";

type SessionStatus = "draft" | "open" | "closed" | "archived";

/**
 * Trạng thái hiển thị của ca — theo đúng luật vào thi (openState, tính ở
 * server bằng session-window.ts), không theo cột `status` thô. Ca theo lịch
 * để "draft" mà đang trong giờ thì thí sinh vẫn vào được; ghi "Nháp" là nói
 * sai với giáo viên.
 */
function displayState(s: Pick<SessionRow, "status" | "openState" | "timingMode">) {
  if (s.status === "archived")
    return { label: "Lưu trữ", pill: "bg-amber-50 text-amber-800", dot: "bg-amber-500", stripe: "bg-amber-300" };
  if (s.openState === "open")
    return { label: "Đang mở", pill: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200", dot: "bg-emerald-500", stripe: "bg-emerald-500" };
  if (s.openState === "not_yet")
    return {
      label: s.timingMode === "manual" ? "Chưa mở" : "Chưa tới giờ",
      pill: "bg-sky-50 text-sky-800",
      dot: "bg-sky-500",
      stripe: "bg-sky-400",
    };
  return { label: "Đã đóng", pill: "bg-slate-100 text-slate-600", dot: "bg-slate-400", stripe: "bg-slate-300" };
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "live" }) {
  return (
    <div className="px-2.5 first:pl-0 sm:px-3 sm:first:pl-3 sm:last:pr-0">
      <div
        className={`text-base font-bold leading-tight tabular-nums ${
          tone === "live" ? "text-emerald-700" : value > 0 ? "text-slate-900" : "text-faint"
        }`}
      >
        {value}
      </div>
      <div className="whitespace-nowrap text-[11px] text-faint">{label}</div>
    </div>
  );
}

export interface SessionRow {
  id: string;
  code: string | null;
  title: string | null;
  status: SessionStatus;
  opensAt: string;
  /** Null khi ca chạy chế độ thủ công. */
  closesAt: string | null;
  examId: string;
  examTitle: string;
  examAccessMode: string;
  courseId: string;
  courseTitle: string;
  roomCount: number;
  /** Đang làm bài ngay lúc này, trong cả ca. */
  inProgress: number;
  /** Đã nộp, trong cả ca. */
  submitted: number;
  timingMode: "scheduled" | "manual";
  openState: "open" | "not_yet" | "closed";
}

export interface CourseInfo {
  courseId: string;
  courseTitle: string;
  courseSlug: string;
}

export interface ExamOption {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
}

export default function SessionsPanel({
  roundId,
  sessions,
  course,
  availableExams,
  canEdit,
}: {
  roundId: string;
  sessions: SessionRow[];
  course: CourseInfo;
  availableExams: ExamOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  // PR2.11 — 1 round = 1 course. All sessions belong to the same course;
  // no grouping needed. Just show sessions in a single flat table.
  void useMemo; // keep import for backward compat if other code uses it

  const patchSession = async (
    sessionId: string,
    body: Record<string, unknown>,
  ): Promise<string | null> => {
    setErr(null);
    const r = await fetch(`/api/exam-sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => null)) as {
        error?: string;
        details?: { reason?: string };
      } | null;
      const msg =
        j?.details?.reason === "exam_course_not_in_round"
          ? "Đề thuộc khoá không có trong đợt — thêm khoá vào đợt trước."
          : j?.error ?? `HTTP ${r.status}`;
      setErr(msg);
      return msg;
    }
    router.refresh();
    return null;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-faint">
          {sessions.length} ca thi trong đợt · <Tag className="inline h-3.5 w-3.5 align-text-bottom text-slate-400" /> {course.courseTitle}.
          {canEdit && " Bấm vào tên, mã, đề hoặc giờ để sửa nhanh."}
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-token bg-white px-4 py-8 text-center text-sm text-faint">
          Chưa có ca thi nào trong đợt này. Ca thi mới tạo ở Tổ chức thi › Kỳ thi chính thức.
        </div>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s, idx) => {
            const href = `/instructor/exam-sessions/${s.id}`;
            const state = displayState(s);
            return (
              <li
                key={s.id}
                className="relative overflow-hidden rounded-xl border border-token bg-white shadow-sm"
              >
                {/* Dải màu trạng thái — nhìn lướt cả đợt là biết ca nào đang chạy. */}
                <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${state.stripe}`} />

                <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-faint">
                        Ca {idx + 1}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${state.pill}`}
                      >
                        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${state.dot}`} />
                        {state.label}
                      </span>
                      <AccessModeBadge
                        examId={s.examId}
                        accessMode={s.examAccessMode}
                        canEdit={canEdit}
                        onChange={(mode) => applyAccessMode(s.id, mode, router, setErr)}
                      />
                    </div>

                    {/* Tên ca — thứ để nhận ra ca, nên to nhất thẻ. */}
                    <div className="-ml-2 mt-0.5">
                      {canEdit ? (
                        <InlineTextCell
                          value={s.title ?? ""}
                          onSave={(v) => patchSession(s.id, { title: v.trim() || null })}
                          ariaLabel="Đổi tên ca"
                          placeholder="Đặt tên ca…"
                          size="lg"
                        />
                      ) : (
                        <Link href={href} className="px-2 text-base font-semibold hover:underline">
                          {s.title ?? "(Chưa đặt tên)"}
                        </Link>
                      )}
                    </div>

                    {/* Mã ca · đề · giờ trên MỘT dòng (xuống dòng khi chật). Mỗi
                        mẩu tự sửa được tại chỗ; icon thay cho nhãn chữ để đỡ tốn
                        một cột. */}
                    <div className="-ml-2 flex flex-wrap items-center gap-x-0.5 text-sm text-muted">
                      <span className="inline-flex items-center" title="Mã ca">
                        <Hash className="ml-2 h-3.5 w-3.5 shrink-0 text-faint" aria-label="Mã ca" />
                        {canEdit ? (
                          <InlineTextCell
                            value={s.code ?? ""}
                            mono
                            onSave={(v) => patchSession(s.id, { code: v.trim() || null })}
                            ariaLabel="Đổi mã ca"
                            placeholder="chưa có mã"
                          />
                        ) : (
                          <span className="px-2 font-mono">{s.code ?? "—"}</span>
                        )}
                      </span>
                      <span className="inline-flex min-w-0 items-center" title="Đề thi">
                        <FileText className="ml-2 h-3.5 w-3.5 shrink-0 text-faint" aria-label="Đề thi" />
                        {canEdit ? (
                          <InlineExamCell
                            currentExamId={s.examId}
                            currentExamTitle={s.examTitle}
                            options={availableExams}
                            onPick={(examId) => patchSession(s.id, { examId })}
                          />
                        ) : (
                          <span className="px-2">{s.examTitle}</span>
                        )}
                      </span>
                      <span className="inline-flex flex-wrap items-center" title="Giờ vào thi">
                        <CalendarClock className="ml-2 h-3.5 w-3.5 shrink-0 text-faint" aria-label="Giờ vào thi" />
                        {canEdit ? (
                          <InlineDateTimeCell
                            value={s.opensAt}
                            onSave={(iso) => patchSession(s.id, { opensAt: iso })}
                            ariaLabel="Đổi thời gian mở"
                          />
                        ) : (
                          <span className="px-2">{formatDate(s.opensAt)}</span>
                        )}
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
                        {s.closesAt === null ? (
                          <span className="px-2 text-faint">đóng khi bấm Đóng</span>
                        ) : canEdit ? (
                          <InlineDateTimeCell
                            value={s.closesAt}
                            onSave={(iso) => patchSession(s.id, { closesAt: iso })}
                            ariaLabel="Đổi thời gian đóng"
                          />
                        ) : (
                          <span className="px-2">{formatDate(s.closesAt)}</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Cấp đợt chỉ cần con số mỗi ca. Muốn nhìn từng thí sinh thì
                      vào ca → phòng — 1000 thẻ trên một màn hình không ai đọc. */}
                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-token pt-3 sm:flex-col sm:flex-nowrap sm:items-end sm:justify-center sm:gap-2 sm:border-0 sm:pt-0">
                    <div className="flex divide-x divide-slate-200 text-center">
                      <Stat label="Phòng" value={s.roomCount} />
                      <Stat label="Đang làm" value={s.inProgress} tone={s.inProgress > 0 ? "live" : undefined} />
                      <Stat label="Đã nộp" value={s.submitted} />
                    </div>
                    <Link
                      href={href}
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                    >
                      Phòng &amp; thí sinh
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {err && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

    </div>
  );
}

function formatDate(iso: string): string {
  return formatDateTime(iso);
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

// ============================================================================
// Inline cells
// ============================================================================

function InlineTextCell({
  value,
  onSave,
  ariaLabel,
  placeholder,
  mono,
  size,
}: {
  value: string;
  onSave: (next: string) => Promise<string | null>;
  ariaLabel: string;
  placeholder?: string;
  mono?: boolean;
  /** "lg" cho tên ca — dòng to nhất thẻ. */
  size?: "lg";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);

  const commit = async () => {
    if (busy) return;
    if (draft === value) {
      setEditing(false);
      return;
    }
    setBusy(true);
    const err = await onSave(draft);
    setBusy(false);
    if (!err) setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        aria-label={ariaLabel}
        className={`max-w-full rounded-md border border-transparent px-2 py-0.5 text-left hover:border-token hover:bg-slate-50 ${
          mono ? "font-mono text-sm tracking-wide" : size === "lg" ? "text-base font-semibold" : "text-sm"
        }`}
      >
        {value || (
          <span className={`italic text-faint ${size === "lg" ? "font-normal" : ""}`}>
            {placeholder ?? "—"}
          </span>
        )}
      </button>
    );
  }
  return (
    <input
      type="text"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      disabled={busy}
      placeholder={placeholder}
      className={`w-full min-w-[12rem] rounded-md border border-brand-400 bg-white px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-50 ${
        mono ? "font-mono text-sm" : size === "lg" ? "text-base font-semibold" : "text-sm"
      }`}
    />
  );
}

function InlineExamCell({
  currentExamId,
  currentExamTitle,
  options,
  onPick,
}: {
  currentExamId: string;
  currentExamTitle: string;
  options: ExamOption[];
  onPick: (examId: string) => Promise<string | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Đổi đề thi (hiện: ${currentExamTitle})`}
        className="max-w-full truncate rounded-md border border-transparent px-2 py-0.5 text-left text-sm hover:border-token hover:bg-slate-50"
        title={currentExamTitle}
      >
        {currentExamTitle}
      </button>
    );
  }
  return (
    <select
      autoFocus
      value={currentExamId}
      disabled={busy}
      onChange={async (e) => {
        const next = e.target.value;
        if (!next || next === currentExamId) {
          setEditing(false);
          return;
        }
        setBusy(true);
        const err = await onPick(next);
        setBusy(false);
        if (!err) setEditing(false);
      }}
      onBlur={() => setEditing(false)}
      className="w-full min-w-[14rem] rounded-md border border-brand-400 bg-white px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-50"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.title} — {o.courseTitle}
        </option>
      ))}
    </select>
  );
}

function InlineDateTimeCell({
  value,
  onSave,
  ariaLabel,
}: {
  value: string;
  onSave: (iso: string) => Promise<string | null>;
  ariaLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(toLocalInput(value));
  const [busy, setBusy] = useState(false);

  const commit = async () => {
    if (busy) return;
    const newIso = new Date(draft).toISOString();
    if (newIso === value) {
      setEditing(false);
      return;
    }
    setBusy(true);
    const err = await onSave(newIso);
    setBusy(false);
    if (!err) setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(toLocalInput(value));
          setEditing(true);
        }}
        aria-label={ariaLabel}
        className="whitespace-nowrap rounded-md border border-transparent px-2 py-0.5 text-left text-sm tabular-nums hover:border-token hover:bg-slate-50"
      >
        {formatDate(value)}
      </button>
    );
  }
  return (
    <input
      type="datetime-local"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          setDraft(toLocalInput(value));
          setEditing(false);
        }
      }}
      disabled={busy}
      className="rounded-md border border-brand-400 bg-white px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-50"
    />
  );
}

// ============================================================================
// AccessMode badge — visible on each session row.
// ============================================================================

const MODE_LABEL: Record<string, string> = {
  assigned_code: "Theo phòng",
  open_code: "Tự do",
  authenticated: "Chưa chọn",
};
const MODE_ICON: Record<string, React.ElementType> = {
  assigned_code: Users,
  open_code: Globe,
  authenticated: AlertTriangle,
};
const MODE_TONE: Record<string, string> = {
  assigned_code: "bg-blue-50 text-blue-800 border-blue-200",
  open_code: "bg-purple-50 text-purple-800 border-purple-200",
  authenticated: "bg-amber-50 text-amber-800 border-amber-300",
};

async function applyAccessMode(
  sessionId: string,
  mode: "assigned_code" | "open_code",
  router: ReturnType<typeof useRouter>,
  setErr: (s: string | null) => void,
): Promise<void> {
  setErr(null);
  // PR2.12 — Per-session mode. PATCH ExamSession thay vì Exam.
  const r = await fetch(`/api/exam-sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accessMode: mode }),
  });
  if (!r.ok) {
    const j = (await r.json().catch(() => null)) as { error?: string } | null;
    setErr(j?.error ?? `HTTP ${r.status}`);
    return;
  }
  router.refresh();
}

function AccessModeBadge({
  examId,
  accessMode,
  canEdit,
  onChange,
}: {
  examId: string;
  accessMode: string;
  canEdit: boolean;
  onChange: (mode: "assigned_code" | "open_code") => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const tone = MODE_TONE[accessMode] ?? MODE_TONE.authenticated;
  const label = MODE_LABEL[accessMode] ?? accessMode;
  const ModeIcon = MODE_ICON[accessMode] ?? AlertTriangle;
  void examId;

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={async () => {
            await onChange("assigned_code");
            setEditing(false);
          }}
          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] hover:opacity-80 ${
            accessMode === "assigned_code"
              ? "border-blue-500 bg-blue-100 font-semibold text-blue-800"
              : "border-slate-300 bg-white text-slate-700"
          }`}
          title="Mỗi sinh viên 1 mã 8 ký tự, gán vào phòng"
        >
          <Users className="h-3 w-3" /> Theo phòng
        </button>
        <button
          type="button"
          onClick={async () => {
            await onChange("open_code");
            setEditing(false);
          }}
          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] hover:opacity-80 ${
            accessMode === "open_code"
              ? "border-purple-500 bg-purple-100 font-semibold text-purple-800"
              : "border-slate-300 bg-white text-slate-700"
          }`}
          title="1 mã chung 6 ký tự, sinh viên tự nhập tên khi vào"
        >
          <Globe className="h-3 w-3" /> Tự do
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-[10px] text-slate-500 hover:underline"
        >
          Huỷ
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <span
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}
      >
        <ModeIcon className="h-3 w-3" />{label}
      </span>
      {canEdit && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded px-1 text-xs text-brand-700 hover:underline"
        >
          Đổi
        </button>
      )}
    </div>
  );
}
