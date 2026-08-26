"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Globe, GraduationCap, Tag, Users, X } from "lucide-react";
import { formatDateTime } from "@/lib/datetime";

type SessionStatus = "draft" | "open" | "closed" | "archived";

const STATUS_LABEL: Record<SessionStatus, string> = {
  draft: "Nháp",
  open: "Đang mở",
  closed: "Đã đóng",
  archived: "Lưu trữ",
};
const STATUS_TONE: Record<SessionStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  open: "bg-emerald-100 text-emerald-800",
  closed: "bg-slate-200 text-slate-700",
  archived: "bg-amber-100 text-amber-800",
};

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
  const [showBulk, setShowBulk] = useState(false);
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

  const noExams = availableExams.length === 0;

  return (
    <div className="space-y-5">
      {canEdit && noExams && (
        <div className="banner-warning flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              Khoá <strong>{course.courseTitle}</strong> chưa có đề thi nào. Cần tạo ít nhất 1 đề trước khi thêm ca thi.
            </span>
          </div>
          <Link
            href={`/instructor/exams/new?courseId=${course.courseId}`}
            className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Tạo đề thi →
          </Link>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-faint">
          {sessions.length} ca thi trong đợt · <Tag className="inline h-3.5 w-3.5 align-text-bottom text-slate-400" /> {course.courseTitle}.
          {canEdit &&
            " Click vào ô bất kỳ (mã / tên / đề / thời gian) để sửa nhanh."}
        </p>
        {canEdit && (
          <button
            onClick={() => setShowBulk(true)}
            disabled={availableExams.length === 0}
            title={
              availableExams.length === 0
                ? "Khoá học chưa có đề thi nào"
                : ""
            }
            className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            + Thêm ca thi
          </button>
        )}
      </div>

      <section className="overflow-hidden rounded-lg border border-default bg-white">
          {sessions.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-faint">
              Chưa có ca thi nào trong đợt này.{" "}
              {canEdit && "Click \"+ Thêm ca thi\" để bắt đầu."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">STT</th>
                  <th className="px-3 py-2">Mã ca</th>
                  <th className="px-3 py-2">Tên</th>
                  <th className="px-3 py-2">Đề thi</th>
                  <th className="px-3 py-2">Chế độ</th>
                  <th className="px-3 py-2">Mở từ</th>
                  <th className="px-3 py-2">Đóng lúc</th>
                  <th className="px-4 py-2 text-right">Phòng</th>
                  <th className="px-4 py-2">Trạng thái</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, idx) => {
                  const href = `/instructor/exam-rounds/${roundId}/sessions/${s.id}`;
                  return (
                    <tr key={s.id} className="border-t border-default">
                      <td className="px-4 py-2 text-xs text-faint">
                        {idx + 1}
                      </td>
                      <td className="px-2 py-1">
                        {canEdit ? (
                          <InlineTextCell
                            value={s.code ?? ""}
                            mono
                            onSave={(v) =>
                              patchSession(s.id, { code: v.trim() || null })
                            }
                            ariaLabel={`Đổi mã ca`}
                            placeholder="—"
                          />
                        ) : s.code ? (
                          <span className="font-mono text-xs">{s.code}</span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {canEdit ? (
                          <div className="flex items-center gap-1">
                            <InlineTextCell
                              value={s.title ?? ""}
                              onSave={(v) =>
                                patchSession(s.id, {
                                  title: v.trim() || null,
                                })
                              }
                              ariaLabel={`Đổi tên ca`}
                              placeholder="(Chưa đặt tên)"
                            />
                            <Link
                              href={href}
                              className="text-xs text-blue-600 hover:underline"
                              title="Vào chi tiết ca"
                            >
                              ↗
                            </Link>
                          </div>
                        ) : (
                          <Link
                            href={href}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {s.title ?? "(Chưa đặt tên)"}
                          </Link>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {canEdit ? (
                          <InlineExamCell
                            currentExamId={s.examId}
                            currentExamTitle={s.examTitle}
                            options={availableExams}
                            onPick={(examId) =>
                              patchSession(s.id, { examId })
                            }
                          />
                        ) : (
                          <span className="text-xs text-faint">
                            {s.examTitle}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <AccessModeBadge
                          examId={s.examId}
                          accessMode={s.examAccessMode}
                          canEdit={canEdit}
                          onChange={(mode) =>
                            applyAccessMode(s.id, mode, router, setErr)
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        {canEdit ? (
                          <InlineDateTimeCell
                            value={s.opensAt}
                            onSave={(iso) =>
                              patchSession(s.id, { opensAt: iso })
                            }
                            ariaLabel="Đổi thời gian mở"
                          />
                        ) : (
                          <span className="text-xs text-faint">
                            {formatDate(s.opensAt)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {s.closesAt === null ? (
                          <span className="text-xs text-faint">
                            đóng thủ công
                          </span>
                        ) : canEdit ? (
                          <InlineDateTimeCell
                            value={s.closesAt}
                            onSave={(iso) =>
                              patchSession(s.id, { closesAt: iso })
                            }
                            ariaLabel="Đổi thời gian đóng"
                          />
                        ) : (
                          <span className="text-xs text-faint">
                            {s.closesAt ? formatDate(s.closesAt) : "đóng thủ công"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">{s.roomCount}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${STATUS_TONE[s.status]}`}
                        >
                          {STATUS_LABEL[s.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          href={href}
                          className="whitespace-nowrap text-xs font-medium text-blue-600 hover:underline"
                        >
                          Xem chi tiết →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

      {err && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      {showBulk && (
        <BulkCreateSessionsDialog
          roundId={roundId}
          availableExams={availableExams}
          onClose={() => setShowBulk(false)}
          onDone={() => {
            setShowBulk(false);
            router.refresh();
          }}
        />
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
}: {
  value: string;
  onSave: (next: string) => Promise<string | null>;
  ariaLabel: string;
  placeholder?: string;
  mono?: boolean;
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
        className={`w-full rounded border border-transparent px-2 py-1 text-left text-sm hover:border-default hover:bg-slate-50 ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value || (
          <span className="italic text-slate-300">{placeholder ?? "—"}</span>
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
      className={`w-full rounded border border-blue-400 bg-white px-2 py-1 text-sm focus:outline-none disabled:opacity-50 ${
        mono ? "font-mono text-xs" : ""
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
        className="w-full rounded border border-transparent px-2 py-1 text-left text-xs text-faint hover:border-default hover:bg-slate-50"
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
      className="w-full rounded border border-blue-400 bg-white px-2 py-1 text-xs focus:outline-none disabled:opacity-50"
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
        className="w-full rounded border border-transparent px-2 py-1 text-left text-xs text-faint hover:border-default hover:bg-slate-50"
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
      className="w-full rounded border border-blue-400 bg-white px-2 py-1 text-xs focus:outline-none disabled:opacity-50"
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
  assigned_code: "bg-blue-100 text-blue-800 border-blue-300",
  open_code: "bg-purple-100 text-purple-800 border-purple-300",
  authenticated: "bg-amber-100 text-amber-800 border-amber-300",
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
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}
      >
        <ModeIcon className="h-3 w-3" />{label}
      </span>
      {canEdit && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[10px] text-blue-600 hover:underline"
        >
          Đổi
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Bulk create sessions dialog — N + prefix + Mode picker (Phase B).
// ============================================================================

function BulkCreateSessionsDialog({
  roundId,
  availableExams,
  onClose,
  onDone,
}: {
  roundId: string;
  availableExams: ExamOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [count, setCount] = useState(3);
  const [prefix, setPrefix] = useState("Ca");
  const [mode, setMode] = useState<"assigned_code" | "open_code" | null>(null);
  // "" = tự động (đề đầu tiên của khoá); ngược lại = examId đã chọn.
  const [examId, setExamId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (count < 1 || count > 50) {
      setErr("Số ca phải từ 1 đến 50.");
      return;
    }
    if (!mode) {
      setErr("Chọn chế độ thi (Theo phòng / Tự do).");
      return;
    }
    if (!examId) {
      setErr("Chọn đề thi cho các ca.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/exam-rounds/${roundId}/sessions/bulk`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          count,
          namePrefix: prefix.trim() || "Ca",
          // Backend applies this mode to the round's exam after creating
          // sessions. Mode is per-exam currently (not per-session).
          accessMode: mode,
          // examId chọn tay; bỏ trống → backend lấy đề đầu tiên của khoá.
          ...(examId ? { examId } : {}),
        }),
      });
      const j = (await r.json().catch(() => null)) as {
        created?: number;
        error?: string;
        details?: { reason?: string };
      } | null;
      if (!r.ok) {
        if (j?.details?.reason === "round_has_no_exam")
          setErr(
            "Đợt chưa có đề thi nào. Tạo đề thi trong khoá học trước.",
          );
        else setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex w-full max-w-sm flex-col rounded-lg bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-default px-5 py-3">
          <h3 className="text-base font-semibold">Tạo nhiều ca thi</h3>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng"
            className="rounded p-1 text-faint hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </header>
        <div className="space-y-3 px-5 py-4">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600">
              Số lượng ca <span className="text-red-600">*</span>
            </span>
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) =>
                setCount(Number.parseInt(e.target.value, 10) || 0)
              }
              className="mt-1 w-full rounded border border-default px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <span className="mt-1 block text-[11px] text-faint">
              Tối đa 50 ca/lần. Tên mặc định: "{prefix.trim() || "Ca"} 1",
              "{prefix.trim() || "Ca"} 2"…
            </span>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600">
              Tiền tố tên (tuỳ chọn)
            </span>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              maxLength={40}
              placeholder="Ca"
              className="mt-1 w-full rounded border border-default px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-slate-600">
              Đề thi cho các ca <span className="text-red-600">*</span>
            </span>
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">— Chọn đề thi —</option>
              {availableExams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-faint">
              {availableExams.length === 0
                ? "Khoá chưa có đề thi nào — tạo đề trong khoá trước."
                : `Áp dụng cho tất cả ${count} ca. Có thể đổi đề từng ca sau khi tạo.`}
            </span>
          </label>

          <div>
            <span className="block text-xs font-medium text-slate-600">
              Chế độ thi <span className="text-red-600">*</span>
            </span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("assigned_code")}
                className={`rounded-lg border-2 p-3 text-left transition-colors ${
                  mode === "assigned_code"
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-sm"><Users className="h-3.5 w-3.5 shrink-0" /> Theo phòng</div>
                <div className="mt-0.5 text-[11px] text-faint">
                  Có danh sách thí sinh + mã cá nhân 8 ký tự cho từng người
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode("open_code")}
                className={`rounded-lg border-2 p-3 text-left transition-colors ${
                  mode === "open_code"
                    ? "border-purple-500 bg-purple-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-sm"><Globe className="h-3.5 w-3.5 shrink-0" /> Tự do</div>
                <div className="mt-0.5 text-[11px] text-faint">
                  1 mã chung 6 ký tự cho cả lớp, sinh viên tự nhập tên
                </div>
              </button>
            </div>
            <p className="mt-1 text-[11px] text-faint">
              Lưu ý: mode được set lên gói đề thi, ảnh hưởng tất cả ca khác
              của cùng đề.
            </p>
          </div>

          <p className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            Hệ thống tạo {count} ca với{" "}
            {examId
              ? `đề "${availableExams.find((e) => e.id === examId)?.title ?? "đã chọn"}"`
              : "đề bạn chọn ở trên"}{" "}
            + cửa sổ thời gian mặc định (1 giờ). Sau khi tạo, click vào ô trong
            bảng để sửa nhanh tên / đề / thời gian / chế độ từng ca.
          </p>
          {err && (
            <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t border-default px-5 py-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded border border-default px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "Đang tạo..." : `Tạo ${count} ca thi`}
          </button>
        </footer>
      </div>
    </div>
  );
}
