"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiUrl";
import { tournamentErrorMessage } from "@/lib/tournamentText";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ValidationIssue {
  code: string;
  missionId?: string;
  missionTitle?: string;
  message: string;
}

interface ValidateResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function IssueList({
  items,
  variant,
}: {
  items: ValidationIssue[];
  variant: "error" | "warning";
}) {
  if (items.length === 0) return null;

  const styles = {
    error: {
      wrapper: "rounded-lg border border-danger-200 bg-danger-50 p-3",
      badge: "inline-block rounded bg-danger-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-danger-700",
      text: "text-danger-800",
    },
    warning: {
      wrapper: "rounded-lg border border-warning-200 bg-warning-50 p-3",
      badge: "inline-block rounded bg-warning-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-warning-700",
      text: "text-warning-800",
    },
  };

  const s = styles[variant];

  return (
    <ul className={`space-y-1.5 ${s.wrapper}`}>
      {items.map((issue) => (
        <li key={`${issue.code}-${issue.missionId ?? "global"}`} className="flex items-start gap-2 text-xs">
          <span className={s.badge} aria-hidden>{variant === "error" ? "Cần sửa" : "Lưu ý"}</span>
          <span className={s.text}>{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function TournamentPublishBar({
  tournamentId,
  status,
  registrationCount,
  missionCount,
}: {
  tournamentId: string;
  status: string;
  registrationCount: number;
  missionCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate state
  const [validating, setValidating] = useState(false);
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  // Once validated with only warnings, instructor can confirm to publish anyway
  const [confirmWarnings, setConfirmWarnings] = useState(false);

  // ── Validate then publish flow ──────────────────────────────────────────────

  async function handlePublishClick() {
    setError(null);

    // If we already validated and have only warnings + instructor confirmed → go straight to publish
    if (validateResult && validateResult.valid && confirmWarnings) {
      await doPublish();
      return;
    }

    // Step 1: validate
    setValidating(true);
    setValidateResult(null);
    setConfirmWarnings(false);

    let result: ValidateResult;
    try {
      const res = await fetch(apiUrl(`/api/tournaments/${tournamentId}/validate`));
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(tournamentErrorMessage(d, "Chưa kiểm tra được. Vui lòng thử lại."));
        setValidating(false);
        return;
      }
      result = (await res.json()) as ValidateResult;
    } catch {
      setError("Không thể kết nối máy chủ để validate.");
      setValidating(false);
      return;
    }

    setValidateResult(result);
    setValidating(false);

    // Step 2: if errors → stop (UI shows them)
    if (!result.valid) return;

    // Step 3: if warnings → show them and wait for confirmation
    if (result.warnings.length > 0) return;

    // Step 4: no errors, no warnings → publish immediately
    await doPublish();
  }

  // Instructor clicked "Publish anyway" after seeing warnings
  async function handlePublishAnyway() {
    setConfirmWarnings(true);
    await doPublish();
  }

  // Core publish API call
  async function doPublish() {
    setBusy(true);
    setError(null);
    const res = await fetch(apiUrl(`/api/tournaments/${tournamentId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "published" }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(tournamentErrorMessage(d, "Chưa công bố được. Vui lòng thử lại."));
    }
  }

  async function endEarly() {
    const message =
      status === "active"
        ? "Kết thúc đấu trường ngay bây giờ?\n\nBảng xếp hạng được chốt ở thời điểm này và XP thưởng được trao cho những người đứng đầu. Không thể hoàn tác."
        : `Huỷ đấu trường này?${registrationCount > 0 ? `\n\n${registrationCount} người đã đăng ký sẽ không thể tham gia và không ai nhận thưởng.` : ""}\n\nKhông thể hoàn tác.`;
    if (!window.confirm(message)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(apiUrl(`/api/tournaments/${tournamentId}/end`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(tournamentErrorMessage(d, "Chưa kết thúc được. Vui lòng thử lại."));
    }
  }

  async function deleteTournament() {
    if (!confirm("Xoá đấu trường nháp này? Không thể hoàn tác.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(apiUrl(`/api/tournaments/${tournamentId}`), {
      method: "DELETE",
    });
    if (res.ok) {
      router.push("/instructor/tournaments");
      router.refresh();
      return;
    }
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    setError(tournamentErrorMessage(d, "Chưa xoá được. Vui lòng thử lại."));
  }

  // ── Draft state ─────────────────────────────────────────────────────────────

  if (status === "draft") {
    const hasBlockingIssues = validateResult !== null && !validateResult.valid;
    const hasWarningsOnly =
      validateResult !== null &&
      validateResult.valid &&
      validateResult.warnings.length > 0 &&
      !confirmWarnings;

    return (
      <div className="space-y-3">
        {/* Main bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-token bg-[rgb(var(--surface-muted))] px-5 py-4">
          <div>
            <p className="text-sm font-medium">Đấu trường đang ở dạng nháp</p>
            <p className="mt-0.5 text-xs text-muted">
              Học viên chưa thấy đấu trường này. Công bố để mở đăng ký; đến giờ bắt đầu hệ thống tự chuyển sang đang diễn ra.
            </p>
            {error && (
              <p className="mt-1 text-xs text-danger-600">{error}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Re-validate button — only shown after a failed check */}
            {validateResult !== null && !validateResult.valid && (
              <button
                onClick={() => { setValidateResult(null); setError(null); }}
                disabled={validating || busy}
                className="btn-sm inline-flex items-center justify-center rounded-lg border border-token px-3 py-2 text-sm font-medium transition-colors hover:bg-[rgb(var(--surface))] disabled:opacity-50"
              >
                Kiểm tra lại
              </button>
            )}

            {/* Publish / Publish anyway */}
            {hasWarningsOnly ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setValidateResult(null)}
                  disabled={busy}
                  className="btn-sm inline-flex items-center justify-center rounded-lg border border-token px-3 py-2 text-sm font-medium transition-colors hover:bg-[rgb(var(--surface))] disabled:opacity-50"
                >
                  Xem lại
                </button>
                <button
                  onClick={handlePublishAnyway}
                  disabled={busy}
                  className="btn-sm inline-flex items-center justify-center rounded-lg bg-warning-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-warning-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Đang công bố…" : "Vẫn công bố"}
                </button>
              </div>
            ) : (
              <button
                onClick={handlePublishClick}
                disabled={busy || validating || hasBlockingIssues || missionCount === 0}
                className="btn-sm inline-flex items-center justify-center rounded-lg bg-success-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {validating
                  ? "Đang kiểm tra…"
                  : busy
                    ? "Đang công bố…"
                    : "Công bố"}
              </button>
            )}

            <Link
              href={`/tournaments/${tournamentId}`}
              target="_blank"
              className="btn-sm inline-flex items-center justify-center rounded-lg border border-token px-3 py-2 text-sm font-medium transition-colors hover:bg-[rgb(var(--surface))]"
              title="Mở trang học viên sẽ thấy (chỉ bạn xem được khi còn nháp)"
            >
              Xem như học viên
            </Link>
            <button
              onClick={deleteTournament}
              disabled={busy}
              className="btn-sm inline-flex items-center justify-center rounded-lg border border-danger-300 px-3 py-2 text-sm font-medium text-danger-600 transition-colors hover:bg-danger-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Xoá đấu trường
            </button>
          </div>
        </div>

        {/* Validation result panels */}
        {validateResult && (
          <div className="space-y-2">
            {validateResult.valid && validateResult.warnings.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800">
                <span>✅</span>
                <span>Mọi thứ hợp lệ, đang công bố…</span>
              </div>
            )}

            {validateResult.errors.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-danger-700">
                  {validateResult.errors.length} lỗi cần sửa trước khi công bố:
                </p>
                <IssueList items={validateResult.errors} variant="error" />
              </div>
            )}

            {validateResult.warnings.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-warning-700">
                  {validateResult.warnings.length} lưu ý (không bắt buộc sửa):
                </p>
                <IssueList items={validateResult.warnings} variant="warning" />
              </div>
            )}
          </div>
        )}

        {/* Static hint when missionCount = 0 and no validate result yet */}
        {missionCount === 0 && !validateResult && (
          <p className="text-xs text-warning-700">
            ⚠ Cần có ít nhất 1 nhiệm vụ trước khi công bố.
          </p>
        )}
      </div>
    );
  }

  // ── Published state ────────────────────────────────────────────────────────

  if (status === "published") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent-200 bg-accent-50 px-5 py-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-accent-800">
            Đã công bố, đang chờ đến giờ bắt đầu
          </p>
          <p className="mt-0.5 text-xs text-accent-700">
            Đến giờ bắt đầu, hệ thống tự chuyển sang đang diễn ra (trễ tối đa 5 phút).
            {registrationCount > 0 && (
              <> {registrationCount} người đã đăng ký.</>
            )}
          </p>
          {error && (
            <p className="mt-1 text-xs text-danger-600">{error}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={endEarly}
            disabled={busy}
            className="btn-sm inline-flex items-center justify-center rounded-lg bg-warning-600 px-4 py-2 font-medium text-white transition-all hover:bg-warning-700 disabled:cursor-not-allowed disabled:opacity-50"
            title="Huỷ đấu trường trước khi bắt đầu"
          >
            {busy ? "Đang huỷ…" : "Huỷ đấu trường"}
          </button>
          <span className="chip-accent">Chờ bắt đầu</span>
        </div>
      </div>
    );
  }

  // ── Active state ───────────────────────────────────────────────────────────

  if (status === "active") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-success-200 bg-success-50 px-5 py-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-success-800">Đang diễn ra</p>
          <p className="mt-0.5 text-xs text-success-700">
            Đấu trường đang diễn ra. Bạn có thể kết thúc sớm khi cần.
            {registrationCount > 0 && (
              <> {registrationCount} người tham gia.</>
            )}
          </p>
          {error && (
            <p className="mt-1 text-xs text-danger-600">{error}</p>
          )}
        </div>
        <button
          onClick={endEarly}
          disabled={busy}
          className="btn-sm inline-flex items-center justify-center rounded-lg bg-danger-600 px-4 py-2 font-medium text-white transition-all hover:bg-danger-700 disabled:cursor-not-allowed disabled:opacity-50"
          title="Kết thúc đấu trường trước giờ dự kiến"
        >
          {busy ? "Đang kết thúc…" : "Kết thúc sớm"}
        </button>
      </div>
    );
  }

  // ── Ended state ────────────────────────────────────────────────────────────

  if (status === "ended") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-token bg-[rgb(var(--surface-muted))] px-5 py-4">
        <div>
          <p className="text-sm font-medium">Đấu trường đã kết thúc</p>
          <p className="mt-0.5 text-xs text-muted">
            {registrationCount} người tham gia · {missionCount} nhiệm vụ. Xem kết quả ở tab Bảng xếp hạng.
          </p>
        </div>
        <span className="chip">Đã kết thúc</span>
      </div>
    );
  }

  return null;
}
