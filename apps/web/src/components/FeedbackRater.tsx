"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

export default function FeedbackRater({
  deliveryId,
  initialRating,
}: {
  deliveryId: string;
  initialRating: number | null;
}) {
  const [rating, setRating] = useState<number | null>(initialRating);
  const [busy, setBusy] = useState(false);

  async function rate(value: number) {
    setBusy(true);
    const res = await fetch(apiUrl(`/api/feedback-deliveries/${deliveryId}/rate`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: value }),
    });
    setBusy(false);
    if (res.ok) setRating(value);
  }

  const isUp = rating !== null && rating >= 4;
  const isDown = rating !== null && rating <= 2;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-faint">Hữu ích?</span>
      <button
        onClick={() => rate(5)}
        disabled={busy}
        title="Hữu ích"
        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
          isUp
            ? "bg-success-100 ring-1 ring-success-400"
            : "border border-token bg-[rgb(var(--surface))] hover:border-success-300 hover:bg-success-50"
        }`}
      >
              </button>
      <button
        onClick={() => rate(1)}
        disabled={busy}
        title="Không hữu ích"
        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
          isDown
            ? "bg-accent-100 ring-1 ring-accent-400"
            : "border border-token bg-[rgb(var(--surface))] hover:border-accent-300 hover:bg-accent-50"
        }`}
      >
              </button>
    </div>
  );
}
