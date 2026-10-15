"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

/**
 * Số học viên đang chờ trong phòng chờ của ca. Hỏi định kỳ; chỉ là số tham khảo,
 * không ảnh hưởng vào thi.
 */
export default function LobbyCounter({ sessionId }: { sessionId: string }) {
  const [waiting, setWaiting] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch(apiUrl(`/api/exam-sessions/${sessionId}/lobby`));
        if (!r.ok) return;
        const j = (await r.json()) as { waiting: number };
        if (alive) setWaiting(j.waiting);
      } catch {
        // Bỏ qua: lần sau thử lại.
      }
    };
    poll();
    const t = setInterval(poll, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [sessionId]);

  if (waiting === null) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-token bg-white px-3 py-1 text-sm"
      title="Học viên đang ở phòng chờ của ca (làm mới mỗi 10 giây)"
    >
      <span className={`h-2 w-2 rounded-full ${waiting > 0 ? "animate-pulse bg-emerald-500" : "bg-slate-300"}`} aria-hidden />
      Đang chờ: <b className="tabular-nums">{waiting}</b>
    </span>
  );
}
