"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

/**
 * Lớp phủ của "Chiếu lớp": bút chỉ laser (chấm đỏ đi theo con trỏ) và bút vẽ (nét vẽ lên màn đang chiếu).
 * Nét vẽ nhớ theo từng màn (quay lại màn đó vẫn còn), toạ độ lưu theo tỉ lệ của khung nên đổi cỡ cửa sổ vẫn đúng chỗ.
 * Chỉ nằm trong trình duyệt của người dạy: không lưu lên máy chủ, không ghi gì về học viên.
 */
export type InkTool = "none" | "laser" | "pen";

export interface InkHandle {
  undo(): void;
  clear(): void;
}

interface Stroke {
  color: string;
  /** Độ dày theo tỉ lệ chiều rộng khung. */
  width: number;
  pts: Array<[number, number]>;
}

const TrailMs = 450;

const TeachingInk = forwardRef<InkHandle, { tool: InkTool; color: string; frameKey: string; onWheel?: (dy: number) => void }>(function TeachingInk(
  { tool, color, frameKey, onWheel },
  ref,
) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const laser = useRef<HTMLDivElement>(null);
  const store = useRef(new Map<string, Stroke[]>());
  const live = useRef<Stroke | null>(null);
  const trail = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const raf = useRef(0);

  const strokes = useCallback(() => {
    let list = store.current.get(frameKey);
    if (!list) {
      list = [];
      store.current.set(frameKey, list);
    }
    return list;
  }, [frameKey]);

  const draw = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const all = [...(store.current.get(frameKey) ?? []), ...(live.current ? [live.current] : [])];
    for (const s of all) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = Math.max(2, s.width * w);
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * w, y * h) : ctx.lineTo(x * w, y * h)));
      if (s.pts.length === 1) ctx.lineTo(s.pts[0]![0] * w + 0.01, s.pts[0]![1] * h);
      ctx.stroke();
    }
    // Vệt mờ dần của bút laser.
    const now = performance.now();
    trail.current = trail.current.filter((p) => now - p.t < TrailMs);
    for (const p of trail.current) {
      const a = 1 - (now - p.t) / TrailMs;
      ctx.fillStyle = `rgba(239, 68, 68, ${0.5 * a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 + 6 * a, 0, Math.PI * 2);
      ctx.fill();
    }
    if (trail.current.length) raf.current = requestAnimationFrame(draw);
  }, [frameKey]);

  useImperativeHandle(
    ref,
    () => ({
      undo() {
        strokes().pop();
        draw();
      },
      clear() {
        store.current.set(frameKey, []);
        draw();
      },
    }),
    [draw, frameKey, strokes],
  );

  // Vẽ lại khi đổi màn hoặc đổi cỡ khung.
  useEffect(() => {
    draw();
    const c = canvas.current;
    if (!c) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(c);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf.current);
    };
  }, [draw, tool]);

  if (tool === "none") return null;

  const rel = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  };

  return (
    <div
      className="teach-ink"
      data-tool={tool}
      onWheel={(e) => onWheel?.(e.deltaY)}
      onPointerDown={(e) => {
        if (tool !== "pen") return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const { x, y, w, h } = rel(e);
        live.current = { color, width: 0.006, pts: [[x / w, y / h]] };
        draw();
      }}
      onPointerMove={(e) => {
        const { x, y, w, h } = rel(e);
        if (tool === "laser") {
          if (laser.current) {
            laser.current.style.transform = `translate(${x}px, ${y}px)`;
            laser.current.style.opacity = "1";
          }
          trail.current.push({ x, y, t: performance.now() });
          if (trail.current.length === 1 || !raf.current) raf.current = requestAnimationFrame(draw);
          return;
        }
        if (live.current) {
          live.current.pts.push([x / w, y / h]);
          draw();
        }
      }}
      onPointerUp={() => {
        if (live.current) {
          strokes().push(live.current);
          live.current = null;
          draw();
        }
      }}
      onPointerCancel={() => {
        live.current = null;
        draw();
      }}
      onPointerLeave={() => {
        if (laser.current) laser.current.style.opacity = "0";
      }}
    >
      <canvas ref={canvas} className="teach-ink-canvas" />
      {tool === "laser" ? <div ref={laser} className="teach-laser" aria-hidden /> : null}
    </div>
  );
});

export default TeachingInk;
