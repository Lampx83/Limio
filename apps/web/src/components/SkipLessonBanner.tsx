"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

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
    const res = await fetch(apiUrl(`/api/lessons/${lessonId}/complete`), {
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
    <div className="rounded-2xl border border-success-200 bg-gradient-to-br from-success-50 to-transparent p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-success-700">
            Bạn có thể bỏ qua bài này
          </p>
          <p className="mt-2 text-xs text-success-700/90">
            Hệ thống thấy bạn đã master các skill liên quan:
          </p>
          <ul className="mt-2 space-y-1">
            {masteries.map((m) => (
              <li key={m.skillCode} className="flex items-center gap-2 text-xs">
                <span className="text-success-600">✓</span>
                <span className="font-medium text-success-700">
                  {m.skillName}
                </span>
                <span className="text-success-700/70">
                  {Math.round(m.masteryProbability * 100)}%
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs italic text-success-700/80">
            Bỏ qua sẽ đánh dấu bài này hoàn thành. Bạn vẫn có thể đọc nội dung
            bên dưới nếu muốn.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={onSkip}
            disabled={skipping}
            className="btn-sm inline-flex items-center justify-center gap-2 rounded-lg bg-success-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-success-700 disabled:opacity-50"
          >
            {skipping ? "Đang xử lý..." : "Bỏ qua →"}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="btn-sm inline-flex items-center justify-center gap-2 rounded-lg border border-success-200 bg-[rgb(var(--surface))] px-3 py-1.5 font-medium text-success-700 transition-colors hover:bg-success-50"
          >
            Học bình thường
          </button>
        </div>
      </div>
    </div>
  );
}
