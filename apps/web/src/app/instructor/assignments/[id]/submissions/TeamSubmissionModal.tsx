"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import type { TeamSubmissionEntry } from "@feedbackme/core-lms";
import { DateTime, StatusBadge, UserAvatar } from "@/components/ui";
import { apiUrl } from "@/lib/apiUrl";
import { lmsErrorMessage } from "@/lib/lmsErrors";
import { toast } from "@/lib/toast";
import GradeForm from "./GradeForm";
import AttachmentPreview from "./AttachmentPreview";
import type { SubmissionNav } from "./SubmissionModal";

type Latest = NonNullable<TeamSubmissionEntry["latest"]>;
type Member = Latest["members"][number];

/**
 * Màn hình chấm một bài nộp nhóm (AC D2–D4): bài làm + phần việc từng người,
 * chấm điểm nhóm một lần, chỉnh điểm riêng từng thành viên sau khi đã chấm.
 */
export default function TeamSubmissionModal({
  entry,
  latest,
  maxScore,
  nav,
  onClose,
}: {
  entry: TeamSubmissionEntry;
  latest: Latest;
  maxScore: number;
  nav?: SubmissionNav | null;
  onClose: () => void;
}) {
  // Điểm/nhận xét đang soạn dở: chuyển nhóm sẽ mất, nên hỏi trước (giống bài cá nhân).
  const dirtyRef = useRef(false);
  const setDirty = useCallback((d: boolean) => {
    dirtyRef.current = d;
  }, []);
  const go = useCallback((fn: (() => void) | null | undefined) => {
    if (!fn) return;
    if (
      dirtyRef.current &&
      !window.confirm("Điểm/nhận xét nhóm này chưa lưu và sẽ mất. Vẫn chuyển sang nhóm khác?")
    )
      return;
    fn();
  }, []);
  const onPrev = nav?.onPrev;
  const onNext = nav?.onNext;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      go(e.key === "ArrowLeft" ? onPrev : onNext);
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, go, onPrev, onNext]);

  const isGraded = latest.status === "graded";
  const hasAttachment = !!latest.attachmentUrl;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Bài làm của nhóm ${entry.team.name}`}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className={`w-full rounded-2xl bg-[rgb(var(--surface))] shadow-2xl ${
          hasAttachment ? "max-w-2xl lg:max-w-6xl" : "max-w-2xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-token px-5 py-4">
          <div className="min-w-0 sm:flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{entry.team.name}</p>
            <p className="text-caption">{latest.members.length} thành viên lúc nộp</p>
          </div>
          <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto sm:justify-end">
            {nav && (
              <div className="flex items-center gap-1" role="group" aria-label="Chuyển nhóm">
                <button
                  type="button"
                  onClick={() => go(nav.onPrev)}
                  disabled={!nav.onPrev}
                  className="btn-secondary btn-sm"
                  aria-label="Nhóm trước"
                  title="Nhóm trước (←)"
                >
                  ← <span className="hidden sm:inline">Trước</span>
                </button>
                <span className="min-w-[3.5rem] text-center text-xs tabular-nums text-muted" aria-live="polite">
                  {nav.position > 0 ? `${nav.position}/${nav.total}` : "—"}
                </span>
                <button
                  type="button"
                  onClick={() => go(nav.onNext)}
                  disabled={!nav.onNext}
                  className="btn-secondary btn-sm"
                  aria-label="Nhóm sau"
                  title="Nhóm sau (→)"
                >
                  <span className="hidden sm:inline">Sau</span> →
                </button>
              </div>
            )}
            <button type="button" onClick={onClose} className="btn-secondary btn-sm" aria-label="Đóng">
              ✕ Đóng
            </button>
          </div>
        </header>

        <div className="max-h-[75vh] overflow-y-auto p-5">
          <div
            key={`${entry.team.id}-${latest.submissionId}`}
            className={hasAttachment ? "grid gap-5 lg:grid-cols-2 lg:items-start" : ""}
          >
            {latest.attachmentUrl && (
              <div className="lg:sticky lg:top-0">
                <AttachmentPreview url={latest.attachmentUrl} />
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusBadge tone={isGraded ? "success" : "warning"} pulse={!isGraded}>
                  {isGraded ? "Đã chấm" : "Chờ chấm"}
                </StatusBadge>
                <p className="text-caption">
                  Nộp lần cuối bởi {latest.submittedBy?.displayName ?? "—"} lúc{" "}
                  <DateTime value={latest.teamSubmittedAt} format="datetime" />
                </p>
              </div>

              <p className="mt-4 whitespace-pre-wrap rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4 text-sm">
                {latest.body}
              </p>

              <section className="mt-5">
                <h3 className="text-h4">Thành viên lúc nộp</h3>
                {!isGraded && (
                  <p className="text-caption mt-1">Chấm điểm nhóm trước, sau đó mới chỉnh điểm riêng từng người.</p>
                )}
                <ul className="mt-2 space-y-3">
                  {latest.members.map((m) => (
                    <MemberRow
                      key={`${m.submissionId}-${m.score}-${m.scoreOverridden}`}
                      member={m}
                      isCaptain={entry.team.captainId === m.user.id}
                      teamGraded={isGraded}
                      maxScore={maxScore}
                    />
                  ))}
                </ul>
                {entry.joinedAfterSubmit.length > 0 && (
                  <div className="banner-info mt-3 text-sm">
                    <p>
                      Vào nhóm sau lần nộp:{" "}
                      <span className="font-medium">
                        {entry.joinedAfterSubmit.map((u) => u.displayName).join(", ")}
                      </span>
                      .
                    </p>
                    <p className="text-caption mt-0.5">Chưa có bài — lần nộp lại tới của nhóm sẽ gồm họ.</p>
                  </div>
                )}
              </section>

              <section className="mt-5 border-t border-token pt-4">
                <h3 className="text-h4">Điểm nhóm</h3>
                <p className="text-caption mt-1 mb-3">
                  Áp cho mọi thành viên của lần nộp này. Ai đã có điểm riêng thì giữ điểm riêng.
                </p>
                <GradeForm
                  submissionId={latest.submissionId}
                  maxScore={maxScore}
                  initialScore={latest.teamScore}
                  initialFeedback={latest.feedback}
                  isGraded={isGraded}
                  onDirtyChange={setDirty}
                  onSavedNext={nav?.onNext}
                />
              </section>
            </div>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-token px-5 py-3">
          {nav ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={nav.pendingOnly}
                onChange={(e) => nav.onTogglePendingOnly(e.target.checked)}
              />
              Chỉ chuyển qua nhóm chờ chấm
            </label>
          ) : (
            <span />
          )}
          <button type="button" onClick={onClose} className="btn-secondary btn-sm">
            ← Quay lại danh sách
          </button>
        </footer>
      </div>
    </div>
  );
}

function overrideErrorMessage(details: unknown, code: string | undefined, status: number): string {
  if (details === "grade_team_first") return "Chấm điểm nhóm trước rồi mới chỉnh điểm riêng.";
  if (details === "score_exceeds_max") return "Điểm vượt quá điểm tối đa.";
  return lmsErrorMessage(code ?? "server_error", status);
}

function MemberRow({
  member,
  isCaptain,
  teamGraded,
  maxScore,
}: {
  member: Member;
  isCaptain: boolean;
  teamGraded: boolean;
  maxScore: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [score, setScore] = useState(member.scoreOverridden && member.score != null ? String(member.score) : "");
  const [note, setNote] = useState(member.scoreOverrideNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: { score: number | null; note?: string | null }, okMsg: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/submissions/${member.submissionId}/override`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(overrideErrorMessage(d.details, d.error, res.status));
        return;
      }
      toast.success(okMsg);
      setEditing(false);
      router.refresh();
    } catch {
      setError(lmsErrorMessage("network_error", 0));
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(score);
    if (score.trim() === "" || !Number.isInteger(n) || n < 0 || n > maxScore) {
      setError(`Nhập số nguyên từ 0 đến ${maxScore}.`);
      return;
    }
    await send({ score: n, note: note.trim() || null }, `Đã lưu điểm riêng của ${member.user.displayName}`);
  }

  const inputId = `override-${member.submissionId}`;

  return (
    <li className="rounded-xl border border-token p-3">
      <div className="flex flex-wrap items-start gap-2">
        <UserAvatar name={member.user.displayName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{member.user.displayName}</span>
            {isCaptain && <Crown className="h-3.5 w-3.5 text-accent-600" aria-label="Trưởng nhóm" />}
            {member.leftTeam && (
              <StatusBadge tone="neutral" dot={false}>
                đã rời nhóm
              </StatusBadge>
            )}
            {member.scoreOverridden && (
              <StatusBadge tone="accent" dot={false}>
                điểm riêng
              </StatusBadge>
            )}
          </p>
          <p className="text-caption truncate">{member.user.email}</p>
        </div>
        <span className="shrink-0 text-sm tabular-nums">
          {member.score != null ? (
            <span className="font-semibold">
              {member.score}/{maxScore}
            </span>
          ) : (
            <span className="text-faint">Chưa chấm</span>
          )}
        </span>
      </div>

      <div className="mt-2">
        <p className="text-caption">Phần việc của tôi</p>
        {member.contributionNote ? (
          <p className="mt-0.5 whitespace-pre-wrap text-sm">{member.contributionNote}</p>
        ) : (
          <p className="mt-0.5 text-sm text-faint">Chưa ghi.</p>
        )}
      </div>

      {member.scoreOverridden && member.scoreOverrideNote && !editing && (
        <p className="text-caption mt-2">Lý do điểm riêng: {member.scoreOverrideNote}</p>
      )}

      {!editing ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={!teamGraded || busy}
            className="btn-ghost btn-sm"
            title={teamGraded ? undefined : "Chấm điểm nhóm trước"}
          >
            {member.scoreOverridden ? "Sửa điểm riêng" : "Chỉnh điểm riêng"}
          </button>
          {member.scoreOverridden && (
            <button
              type="button"
              onClick={() => send({ score: null }, `${member.user.displayName} về lại điểm nhóm`)}
              disabled={busy}
              className="btn-ghost btn-sm"
            >
              Bỏ điểm riêng
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={save} className="mt-2 space-y-2" noValidate>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={inputId} className="text-meta">
              Điểm riêng
            </label>
            <input
              id={inputId}
              type="number"
              min={0}
              max={maxScore}
              step={1}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="input h-8 w-24"
            />
            <span className="text-caption">/ {maxScore}</span>
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Lý do (không bắt buộc)"
            aria-label="Lý do điểm riêng"
            className="input"
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className="btn-primary btn-sm">
              {busy ? "Đang lưu..." : "Lưu điểm riêng"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="btn-secondary btn-sm"
            >
              Hủy
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="banner-danger mt-2 text-sm">
          {error}
        </p>
      )}
    </li>
  );
}
