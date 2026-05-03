"use client";

import { useState } from "react";

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
    const res = await fetch(`/api/feedback-deliveries/${deliveryId}/rate`, {
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
    <div className="flex items-center gap-1">
      <span className="mr-1 text-xs text-red-700 dark:text-red-300">Hữu ích?</span>
      <button
        onClick={() => rate(5)}
        disabled={busy}
        title="Hữu ích"
        className={`rounded px-1.5 py-0.5 text-sm transition disabled:opacity-50 ${
          isUp
            ? "bg-emerald-200 dark:bg-emerald-800"
            : "hover:bg-red-100 dark:hover:bg-red-900"
        }`}
      >
        👍
      </button>
      <button
        onClick={() => rate(1)}
        disabled={busy}
        title="Không hữu ích"
        className={`rounded px-1.5 py-0.5 text-sm transition disabled:opacity-50 ${
          isDown
            ? "bg-amber-200 dark:bg-amber-800"
            : "hover:bg-red-100 dark:hover:bg-red-900"
        }`}
      >
        👎
      </button>
    </div>
  );
}
