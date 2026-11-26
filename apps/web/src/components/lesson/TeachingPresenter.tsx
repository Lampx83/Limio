"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Timer } from "lucide-react";
import { frameHeading, type TeachingFrame } from "@/lib/teachingFrames";

/**
 * Màn giảng viên của "Chiếu lớp": cửa sổ riêng để thầy/cô đặt ở màn hình của mình, còn cửa sổ Slide đưa sang máy chiếu.
 * Đồng hồ buổi dạy và màn kế tiếp chỉ nằm ở đây nên không lên màn chiếu cho học viên.
 * Hai cửa sổ nói chuyện qua BroadcastChannel cùng trình duyệt (không qua máy chủ, không lưu gì): đổi màn ở bên nào, bên kia theo.
 */
export const teachSyncName = (lessonId: string) => `limio-teach-${lessonId}`;

export type TeachSyncMessage = { type: "idx"; idx: number } | { type: "goto"; idx: number } | { type: "hello" };

export default function TeachingPresenter({ frames, lessonTitle, lessonId }: { frames: TeachingFrame[]; lessonTitle: string; lessonId: string }) {
  const total = frames.length;
  const [idx, setIdx] = useState(0);
  const [linked, setLinked] = useState(false);
  const chan = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const c = new BroadcastChannel(teachSyncName(lessonId));
    chan.current = c;
    c.onmessage = (e: MessageEvent<TeachSyncMessage>) => {
      if (e.data?.type === "idx" && Number.isInteger(e.data.idx)) {
        setIdx(Math.max(0, Math.min(total - 1, e.data.idx)));
        setLinked(true);
      }
    };
    c.postMessage({ type: "hello" } satisfies TeachSyncMessage);
    return () => {
      c.close();
      chan.current = null;
    };
  }, [lessonId, total]);

  const go = useCallback(
    (n: number) => {
      const next = Math.max(0, Math.min(total - 1, n));
      setIdx(next);
      chan.current?.postMessage({ type: "goto", idx: next } satisfies TeachSyncMessage);
    },
    [total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        go(idx + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(idx - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, idx]);

  const frame = frames[idx]!;
  const next = frames[idx + 1];

  return (
    <div className="teach-presenter" data-testid="teach-presenter">
      <header className="teach-presenter-bar">
        <div className="min-w-0">
          <p className="teach-presenter-kicker">Màn giảng viên · không chiếu lên lớp</p>
          <h1 className="truncate text-lg font-bold">{lessonTitle}</h1>
        </div>
        <PresenterTimer />
      </header>

      <section className="teach-presenter-now" aria-label="Màn đang chiếu">
        <p className="teach-presenter-kicker">
          Đang chiếu · {idx + 1}/{total}
        </p>
        <h2 className="teach-presenter-title">{frameHeading(frame) || lessonTitle}</h2>
      </section>

      <section className="teach-presenter-next" aria-label="Màn kế tiếp">
        <p className="teach-presenter-kicker">Kế tiếp</p>
        {next ? (
          <>
            <p className="font-semibold">{frameHeading(next) || "Màn tiếp theo"}</p>
          </>
        ) : (
          <p className="text-muted">Đây là màn cuối.</p>
        )}
      </section>

      <nav className="teach-presenter-nav" aria-label="Chuyển màn">
        <button type="button" className="teach-btn" onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Màn trước">
          <ChevronLeft className="h-6 w-6" />
          <span className="teach-btn-label">Trước</span>
        </button>
        <select className="teach-presenter-jump" value={idx} onChange={(e) => go(Number(e.target.value))} aria-label="Nhảy tới màn">
          {frames.map((f, i) => (
            <option key={i} value={i}>
              {i + 1}. {frameHeading(f) || lessonTitle}
            </option>
          ))}
        </select>
        <button type="button" className="teach-btn" onClick={() => go(idx + 1)} disabled={idx >= total - 1} aria-label="Màn sau">
          <span className="teach-btn-label">Sau</span>
          <ChevronRight className="h-6 w-6" />
        </button>
      </nav>

      <p className="teach-presenter-link" data-linked={linked}>
        {linked ? "Đã nối với cửa sổ Slide: đổi màn ở đây hoặc ở đó đều được." : "Chưa thấy cửa sổ Slide. Mở Slide ở một cửa sổ khác (cùng trình duyệt), rồi kéo sang máy chiếu."}
      </p>
    </div>
  );
}

/** Đồng hồ buổi dạy: chạy từ lúc mở màn giảng viên; bấm để tạm dừng/chạy tiếp, bấm đúp để đặt lại về 00:00. */
function PresenterTimer() {
  const [sec, setSec] = useState(0);
  const [run, setRun] = useState(true);
  useEffect(() => {
    if (!run) return;
    const id = window.setInterval(() => setSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [run]);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const text = `${h ? `${h}:${String(m).padStart(2, "0")}` : String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return (
    <button
      type="button"
      className="teach-btn teach-btn-text teach-timer"
      data-paused={!run}
      onClick={() => setRun((v) => !v)}
      onDoubleClick={() => {
        setSec(0);
        setRun(true);
      }}
      title={run ? "Đồng hồ buổi dạy: bấm để tạm dừng, bấm đúp để đặt lại" : "Đang tạm dừng: bấm để chạy tiếp, bấm đúp để đặt lại"}
      aria-label={`Đồng hồ buổi dạy ${text}`}
    >
      <Timer className="h-4 w-4" aria-hidden />
      <span className="tabular-nums">{text}</span>
    </button>
  );
}
