"use client";

import { useState } from "react";

interface MasteryRow {
  skillCode: string;
  skillName: string;
  masteryProbability: number;
}

export default function SkipLessonBanner({
  lessonId,
  courseSlug,
  nextLessonId,
  masteries,
}: {
  lessonId: string;
  courseSlug: string;
  nextLessonId: string | null;
  masteries: MasteryRow[];
}) {
  const [dismissed, setDismissed] = useState(false);
  const [skipping, setSkipping] = useState(false);

  if (dismissed) return null;

  async function onSkip() {
    setSkipping(true);
    const res = await fetch(`/api/lessons/${lessonId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "skipped" }),
    });
    if (!res.ok) {
      setSkipping(false);
      return;
    }
    window.location.href = nextLessonId
      ? `/learn/${courseSlug}/lessons/${nextLessonId}`
      : `/learn/${courseSlug}`;
  }

  return (
    <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
            🎯 Bạn có thể bỏ qua bài này
          </p>
          <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
            Hệ thống thấy bạn đã master các skill liên quan:
          </p>
          <ul className="mt-2 space-y-0.5 text-xs text-emerald-900 dark:text-emerald-100">
            {masteries.map((m) => (
              <li key={m.skillCode}>
                • {m.skillName}{" "}
                <span className="opacity-70">
                  ({Math.round(m.masteryProbability * 100)}%)
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
            Bỏ qua sẽ đánh dấu bài này hoàn thành. Bạn vẫn có thể đọc nội dung
            bên dưới nếu muốn.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={onSkip}
            disabled={skipping}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {skipping ? "Đang xử lý..." : "Bỏ qua →"}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded border border-emerald-300 px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
          >
            Học bình thường
          </button>
        </div>
      </div>
    </div>
  );
}
