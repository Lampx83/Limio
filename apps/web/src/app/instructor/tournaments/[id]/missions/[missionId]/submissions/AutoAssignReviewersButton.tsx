"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shuffle, Loader2 } from "lucide-react";

const ERROR_LABELS: Record<string, string> = {
  submission_deadline_not_reached: "Chưa tới hạn nộp — chưa thể phân reviewer.",
  verify_mode_mismatch: "Mission này không dùng peer review.",
  forbidden: "Bạn không có quyền thao tác.",
  unauthorized: "Phiên đăng nhập đã hết hạn.",
};

/**
 * Nút cấp-mission: phân reviewer tự động cho TẤT CẢ submission PEER_REVIEW một
 * lượt. Chỉ bật sau khi hết hạn nộp (`canAssign`); trước đó hiển thị tooltip.
 */
export default function AutoAssignReviewersButton({
  tournamentId,
  missionId,
  canAssign,
  deadlineLabel,
}: {
  tournamentId: string;
  missionId: string;
  /** true khi đã qua submissionDeadline. */
  canAssign: boolean;
  /** Hạn nộp đã format, dùng cho tooltip khi nút bị khóa. */
  deadlineLabel: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  async function run(rebalance: boolean) {
    if (
      rebalance &&
      !window.confirm(
        "Phân lại cân bằng sẽ XÓA các lượt review CHƯA chấm rồi chia đều lại cho mọi thành viên (giữ nguyên lượt đã chấm). Tiếp tục?",
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
          body: JSON.stringify({ rebalance }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        assignedCount?: number;
        unassignedCount?: number;
        error?: string;
      };
      if (!res.ok) {
        setMsg({
          kind: "err",
          text: ERROR_LABELS[data.error ?? ""] ?? "Có lỗi xảy ra, thử lại sau.",
        });
        return;
      }
      const n = data.assignedCount ?? 0;
      const u = data.unassignedCount ?? 0;
      setMsg({
        kind: "ok",
        text: rebalance
          ? `Đã chia đều lại: gỡ ${u}, phân ${n} lượt review.`
          : n > 0
            ? `Đã phân thêm ${n} lượt review.`
            : "Tất cả bài đã đủ reviewer.",
      });
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Không kết nối được máy chủ." });
    } finally {
      setBusy(false);
    }
  }

  const disabledTip = !canAssign
    ? deadlineLabel
      ? `Có thể phân sau khi hết hạn nộp (${deadlineLabel})`
      : "Mission chưa đặt hạn nộp"
    : undefined;

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !canAssign}
          onClick={() => run(false)}
          title={disabledTip}
          className="btn-secondary btn-sm inline-flex items-center gap-1.5 disabled:opacity-40"
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Shuffle size={14} />
          )}
          Tự động phân reviewer
        </button>
        <button
          type="button"
          disabled={busy || !canAssign}
          onClick={() => run(true)}
          title={
            disabledTip ??
            "Xóa các lượt chưa chấm và chia đều lại cho mọi thành viên"
          }
          className="btn-ghost btn-sm text-xs underline-offset-2 hover:underline disabled:opacity-40"
        >
          Phân lại cân bằng
        </button>
      </div>
      {disabledTip && !msg && (
        <p className="text-[11px] text-faint">{disabledTip}</p>
      )}
      {msg && (
        <p
          className={`text-xs ${
            msg.kind === "ok" ? "text-success-600" : "text-danger-600"
          }`}
        >
          {msg.kind === "ok" ? "✓ " : "⚠ "}
          {msg.text}
        </p>
      )}
    </div>
  );
}
