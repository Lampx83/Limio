"use client";

import { useEffect, useRef, useState } from "react";
import FeedbackPanel, { type MaterialFeedback } from "./feedback-panel";

export default function EmbedMaterial({
  materialId,
  url,
  kind,
  initialDone,
  initialReflection,
  initialFeedback,
}: {
  materialId: number;
  url: string;
  kind: "slides" | "file" | "link";
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
      body: JSON.stringify({ data: { type: kind, viewed_seconds: elapsed } }),
    });
    if (res.ok) setDone(true);
    setMarking(false);
  }

  return (
    <>
      <div className="card overflow-hidden">
        {kind === "slides" && url && (
          <div className="aspect-video bg-black">
            <iframe
              src={url}
              className="w-full h-full"
              allow="autoplay; fullscreen"
              allowFullScreen
              title="Slides"
            />
          </div>
        )}
        {(kind === "file" || kind === "link") && (
          <div className="p-5 sm:p-6 text-center">
            <div className="text-5xl mb-3">{kind === "file" ? "📎" : "🔗"}</div>
            <p className="text-sm text-slate-500 mb-3">
              {kind === "file" ? "Tài liệu này được lưu ngoài hệ thống" : "Liên kết tới tài nguyên bên ngoài"}
            </p>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="btn-primary inline-block"
            >
              {kind === "file" ? "Tải / Mở tài liệu ↗" : "Mở liên kết ↗"}
            </a>
            <p className="text-xs text-slate-400 mt-3 break-all">{url}</p>
          </div>
        )}
        <div className="p-3 sm:p-4 flex items-center justify-between flex-wrap gap-2 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs sm:text-sm text-slate-500">
            Sau khi xem/đọc xong, đánh dấu hoàn thành để mở khoá AI feedback.
          </p>
          {done ? (
            <span className="badge-green">✓ Đã hoàn thành</span>
          ) : (
            <button onClick={markDone} disabled={marking} className="btn-primary">
              {marking ? "..." : "Đánh dấu đã xem"}
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
