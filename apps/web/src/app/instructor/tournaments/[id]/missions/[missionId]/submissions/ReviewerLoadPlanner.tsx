"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Loader2 } from "lucide-react";
import {
  suggestPeerReviewerCount,
  reviewerCoverage,
} from "@feedbackme/core-gamification";
import { tournamentErrorMessage } from "@/lib/tournamentText";

const MAX_N = 50;

/**
 * Planner "mỗi reviewer chấm K bài". Giáo viên nhập K → tính số reviewer/bài (N)
 * cần thiết theo pool + số bài live, hiện độ phủ, rồi một nút đặt N & phân lại
 * cân bằng. Công thức ở core (suggestPeerReviewerCount) để đồng nhất + test được.
 */
export default function ReviewerLoadPlanner({
  tournamentId,
  missionId,
  submissionCount,
  poolSize,
  currentN,
  captainsOnly,
  canAssign,
  deadlineLabel,
}: {
  tournamentId: string;
  missionId: string;
  submissionCount: number;
  poolSize: number;
  currentN: number;
  captainsOnly: boolean;
  canAssign: boolean;
  deadlineLabel: string | null;
}) {
  const router = useRouter();
  const [k, setK] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  const kNum = Number(k);
  const kValid = Number.isFinite(kNum) && kNum >= 1;
  const suggestedN = kValid
    ? suggestPeerReviewerCount({
        poolSize,
        submissionCount,
        reviewsPerReviewer: Math.floor(kNum),
      })
    : 0;
  const overMax = suggestedN > MAX_N;
  const covered = kValid
    ? reviewerCoverage({
        poolSize,
        submissionCount,
        reviewersPerSubmission: Math.min(suggestedN, MAX_N),
      })
    : 0;
  // N tối thiểu để phủ hết mọi người (K=1).
  const minN = suggestPeerReviewerCount({
    poolSize,
    submissionCount,
    reviewsPerReviewer: 1,
  });

  // Với cách đặt hiện tại, trung bình mỗi người chấm khoảng mấy bài.
  const currentLoad =
    poolSize > 0 ? Math.round((currentN * submissionCount) / poolSize) : 0;
  const poolLabel = captainsOnly ? "đội trưởng" : "người";

  async function apply() {
    if (!kValid || overMax) return;
    if (
      !window.confirm(
        `Mỗi bài sẽ có ${suggestedN} người chấm. Các lượt chưa chấm sẽ được xóa rồi chia lại cho đều, các lượt đã chấm được giữ nguyên. Tiếp tục?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/instructor/tournaments/${tournamentId}/missions/${missionId}/auto-assign-reviewers`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            rebalance: true,
            peerReviewerCount: suggestedN,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        assignedCount?: number;
        unassignedCount?: number;
        error?: string;
      };
      if (!res.ok) {
        setMsg({ kind: "err", text: tournamentErrorMessage(data) });
        return;
      }
      setMsg({
        kind: "ok",
        text: `Mỗi bài giờ có ${suggestedN} người chấm. Đã gỡ ${data.unassignedCount ?? 0} lượt chưa chấm và chia mới ${data.assignedCount ?? 0} lượt.`,
      });
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Không kết nối được máy chủ." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <Calculator size={14} className="text-brand-600" />
        Mỗi người chấm bao nhiêu bài?
      </div>
      <div className="mt-1 space-y-0.5 text-xs text-muted">
        <p>
          Có {submissionCount} bài nộp và {poolSize} {poolLabel} được đi chấm.
          Hiện mỗi bài có {currentN} người chấm, nên mỗi người phải chấm khoảng{" "}
          {currentLoad} bài.
        </p>
        <p>
          Hãy nhập số bài mỗi người chấm, hệ thống sẽ tính mỗi bài cần mấy
          người chấm. Muốn ai cũng chấm ít nhất 1 bài thì mỗi bài cần{" "}
          <button
            type="button"
            onClick={() => setK("1")}
            className="font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
          >
            {minN} người chấm
          </button>
          .
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="text-xs">
          <span className="block text-faint">Mỗi người chấm</span>
          <span className="mt-1 flex items-center gap-1">
            <input
              type="number"
              min={1}
              value={k}
              onChange={(e) => setK(e.target.value)}
              placeholder="vd 3"
              className="input w-20 text-sm"
            />
            bài
          </span>
        </label>

        {kValid && (
          <div className="text-xs">
            {overMax ? (
              <span className="text-danger-600">
                → mỗi bài cần {suggestedN} người chấm, vượt giới hạn {MAX_N}.
                Hãy giảm số bài mỗi người chấm.
              </span>
            ) : (
              <span className="text-muted">
                → mỗi bài cần{" "}
                <strong className="text-[rgb(var(--text))]">
                  {suggestedN} người chấm
                </strong>{" "}
                · {covered}/{poolSize} {poolLabel} được giao chấm
              </span>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={busy || !kValid || overMax || !canAssign}
          onClick={apply}
          title={
            !canAssign && deadlineLabel
              ? `Có thể áp dụng sau khi hết hạn nộp (${deadlineLabel})`
              : undefined
          }
          className="btn-secondary btn-sm ml-auto inline-flex items-center gap-1.5 disabled:opacity-40"
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Calculator size={14} />
          )}
          Áp dụng và chia lại lượt chấm
        </button>
      </div>

      {!canAssign && deadlineLabel && (
        <p className="mt-1 text-[11px] text-faint">
          Áp dụng được sau khi hết hạn nộp ({deadlineLabel}).
        </p>
      )}
      {msg && (
        <p
          className={`mt-1.5 text-xs ${msg.kind === "ok" ? "text-success-600" : "text-danger-600"}`}
        >
          {msg.kind === "ok" ? "✓ " : "⚠ "}
          {msg.text}
        </p>
      )}
    </section>
  );
}
