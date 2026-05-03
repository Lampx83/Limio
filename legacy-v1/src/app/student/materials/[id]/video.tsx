"use client";

import { useEffect, useRef, useState } from "react";
import FeedbackPanel, { type MaterialFeedback } from "./feedback-panel";

export default function VideoMaterial({
  materialId,
  videoUrl,
  initialDone,
  initialReflection,
  initialFeedback,
}: {
  materialId: number;
  videoUrl: string;
  initialDone: boolean;
  initialReflection: string;
  initialFeedback: MaterialFeedback | null;
}) {
  const [done, setDone] = useState(initialDone);
  const [marking, setMarking] = useState(false);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
  }, []);

  async function markDone() {
    setMarking(true);
    const elapsed = Math.round((Date.now() - startRef.current) / 1000);
    const res = await fetch(`/api/materials/${materialId}/interaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: { type: "video", watched_seconds: elapsed },
      }),
    });
    if (res.ok) setDone(true);
    setMarking(false);
  }

  return (
    <>
      <div className="card overflow-hidden">
        <div className="aspect-video bg-black">
          {videoUrl ? (
            <iframe
              src={videoUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              title="Video bài giảng"
            />
          ) : (
            <div className="flex items-center justify-center text-white/60 h-full">
              Không có URL video
            </div>
          )}
        </div>
        <div className="p-3 sm:p-4 flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs sm:text-sm text-slate-500">
            Sau khi xem xong, đánh dấu đã hoàn thành để mở khoá AI feedback.
          </p>
          {done ? (
            <span className="badge-green">✓ Đã hoàn thành</span>
          ) : (
            <button
              onClick={markDone}
              disabled={marking}
              className="btn-primary"
            >
              {marking ? "Đang lưu..." : "Đánh dấu đã xem xong"}
            </button>
          )}
        </div>
      </div>

      <FeedbackPanel
        materialId={materialId}
        done={done}
        initialReflection={initialReflection}
        initialFeedback={initialFeedback}
      />
    </>
  );
}
