"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gavel, Loader2 } from "lucide-react";

/**
 * "Chốt điểm ngay" — GV force-close vòng chấm trước hạn: tính median + ra điểm
 * cho các bài đã đạt quorum, bỏ qua bài chưa đủ. Cron tự động vẫn chạy tới hạn.
 */
export default function CloseReviewsButton({
  tournamentId,
  missionId,
  quorum,
}: {
  tournamentId: string;
  missionId: string;
  quorum: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  async function onClick() {
    if (
      !window.confirm(
        `Chốt điểm ngay: bài đã có ≥${quorum} review hoàn thành sẽ được tính điểm median và ra kết quả. Bài chưa đủ sẽ giữ nguyên chờ thêm. Tiếp tục?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/instructor/tournaments/${tournamentId}/missions/${missionId}/close-reviews`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        closed?: number;
        skippedUnderQuorum?: number;
        error?: string;
      };
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error ?? "Có lỗi xảy ra." });
        return;
      }
      setMsg({
        kind: "ok",
        text: `Đã chốt ${data.closed ?? 0} bài${
          data.skippedUnderQuorum
            ? `, ${data.skippedUnderQuorum} bài chưa đủ quorum (chờ thêm review)`
            : ""
        }.`,
      });
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Không kết nối được máy chủ." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        className="btn-secondary btn-sm inline-flex items-center gap-1.5 disabled:opacity-40"
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Gavel size={14} />
        )}
        Chốt điểm ngay
      </button>
      {msg && (
        <p
          className={`text-xs ${msg.kind === "ok" ? "text-success-600" : "text-danger-600"}`}
        >
          {msg.kind === "ok" ? "✓ " : "⚠ "}
          {msg.text}
        </p>
      )}
    </div>
  );
}
