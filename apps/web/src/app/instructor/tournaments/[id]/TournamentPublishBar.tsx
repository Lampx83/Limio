"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

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
          <span className={s.badge}>{issue.code}</span>
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
        setError(d.error ?? "validate_failed");
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
      setError(d.error ?? "publish_failed");
    }
  }

  async function endEarly() {
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
      setError(d.error ?? "end_failed");
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
    setError(d.error ?? "delete_failed");
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
            <p className="text-sm font-medium">Đấu trường chưa publish</p>
            <p className="mt-0.5 text-xs text-muted">
              Publish để cho phép learner đăng ký. Cron tự flip sang active khi đến giờ bắt đầu.
            </p>
            {error && (
              <p className="mt-1 text-xs text-danger-600">Lỗi: {error}</p>
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
                  {busy ? "Đang publish..." : "Vẫn publish"}
                </button>
              </div>
            ) : (
              <button
                onClick={handlePublishClick}
                disabled={busy || validating || hasBlockingIssues || missionCount === 0}
                className="btn-sm inline-flex items-center justify-center rounded-lg bg-success-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {validating
                  ? "Đang kiểm tra..."
                  : busy
                    ? "Đang publish..."
                    : "Publish"}
              </button>
            )}

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
                <span>Không có lỗi — đang publish…</span>
              </div>
            )}

            {validateResult.errors.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-danger-700">
                  {validateResult.errors.length} lỗi phải sửa trước khi publish:
                </p>
                <IssueList items={validateResult.errors} variant="error" />
              </div>
            )}

            {validateResult.warnings.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-warning-700">
                  {validateResult.warnings.length} cảnh báo (không bắt buộc sửa):
                </p>
                <IssueList items={validateResult.warnings} variant="warning" />
              </div>
            )}
          </div>
        )}

        {/* Static hint when missionCount = 0 and no validate result yet */}
        {missionCount === 0 && !validateResult && (
          <p className="text-xs text-warning-700">
            ⚠ Cần có ít nhất 1 mission trước khi publish.
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
            Đã publish — đang chờ bắt đầu
          </p>
          <p className="mt-0.5 text-xs text-accent-700">
            Cron sẽ tự động flip sang active khi đến giờ bắt đầu.
            {registrationCount > 0 && (
              <> {registrationCount} người đã đăng ký.</>
            )}
          </p>
          {error && (
            <p className="mt-1 text-xs text-danger-600">Lỗi: {error}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={endEarly}
            disabled={busy}
            className="btn-sm inline-flex items-center justify-center rounded-lg bg-warning-600 px-4 py-2 font-medium text-white transition-all hover:bg-warning-700 disabled:cursor-not-allowed disabled:opacity-50"
            title="Hủy đấu trường trước khi bắt đầu"
          >
            {busy ? "Đang hủy..." : "Hủy đấu trường"}
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
            Đấu trường đang hoạt động. Không thể hoàn tác.
            {registrationCount > 0 && (
              <> {registrationCount} người tham gia.</>
            )}
          </p>
          {error && (
            <p className="mt-1 text-xs text-danger-600">Lỗi: {error}</p>
          )}
        </div>
        <button
          onClick={endEarly}
          disabled={busy}
          className="btn-sm inline-flex items-center justify-center rounded-lg bg-danger-600 px-4 py-2 font-medium text-white transition-all hover:bg-danger-700 disabled:cursor-not-allowed disabled:opacity-50"
          title="Kết thúc đấu trường sớm trước deadline"
        >
          {busy ? "Đang kết thúc..." : "Kết thúc sớm"}
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
            {registrationCount} người tham gia · {missionCount} missions. Giải thưởng đã được phân phối tự động.
          </p>
        </div>
        <span className="chip">Đã kết thúc</span>
      </div>
    );
  }

  return null;
}
