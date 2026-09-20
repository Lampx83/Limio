"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { tournamentErrorMessage } from "@/lib/tournamentText";

export default function VoteButton({
  tournamentId,
  missionId,
  submissionId,
  initialVoted,
  initialCount,
  disabled,
  disabledReason,
}: {
  tournamentId: string;
  missionId: string;
  submissionId: string;
  initialVoted: boolean;
  initialCount: number;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [voted, setVoted] = useState(initialVoted);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Đồng bộ lại theo dữ liệu máy chủ sau router.refresh(): khi đổi phiếu sang bài khác,
  // thẻ cũ phải bỏ tim và giảm số phiếu (trước đây state chỉ lấy giá trị lúc mở trang).
  useEffect(() => {
    setVoted(initialVoted);
    setCount(initialCount);
  }, [initialVoted, initialCount]);

  async function toggle() {
    if (disabled) return;
    const next = !voted;
    setError(null);
    setVoted(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      const res = next
        ? await fetch(apiUrl(`/api/tournaments/${tournamentId}/votes`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ submissionId }),
          })
        : await fetch(apiUrl(`/api/tournaments/${tournamentId}/votes?missionId=${missionId}`), {
            method: "DELETE",
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setVoted(!next);
        setCount((c) => c - (next ? 1 : -1));
        setError(tournamentErrorMessage(body, "Chưa bình chọn được. Vui lòng thử lại."));
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setVoted(!next);
      setCount((c) => c - (next ? 1 : -1));
      setError(tournamentErrorMessage({ error: "network_error" }));
    }
  }

  return (
    <>
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || pending}
      title={error ?? (disabled ? disabledReason : voted ? "Bỏ bình chọn" : "Bình chọn bài này")}
      aria-pressed={voted}
      aria-label={`Bình chọn, hiện có ${count} phiếu`}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
        voted
          ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
          : disabled
            ? "cursor-not-allowed border-token text-faint opacity-60"
            : "border-token text-[rgb(var(--text-muted))] hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
      }`}
    >
      <Heart
        size={12}
        strokeWidth={2.5}
        className={voted ? "fill-rose-500 text-rose-500" : ""}
      />
      {count}
    </button>
    {error && (
      <span role="alert" className="text-[11px] font-medium text-danger-600">
        {error}
      </span>
    )}
    </>
  );
}
