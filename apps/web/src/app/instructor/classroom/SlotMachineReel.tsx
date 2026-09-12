"use client";

import { useEffect, useRef, useState } from "react";

export interface ResolvedReelTarget {
  /** Full roster to animate through (server/controlled mode). */
  names: string[];
  /** Winning index within `names`. */
  index: number;
  /** Winning display name (kept explicit in case of duplicate names). */
  winner: string;
}

interface SlotMachineReelProps {
  /** Names to spin through in self-contained (client-random-pick) mode. */
  names?: string[];
  onSpinStart?: () => void;
  onSpinEnd: (winner: string, index: number) => void;
  /**
   * Async resolver called on click, before spinning starts — used when the
   * winner must come from the server (e.g. classroom mode with anti-repeat
   * logic). When provided, `names` is only used for the idle preview.
   */
  resolveTarget?: () => Promise<ResolvedReelTarget | null>;
  height?: number;
  idleLabel?: string;
  triggerLabel?: string;
}

const VISIBLE_ROWS = 5;
const RENDER_PAD = 4; // rows rendered above/below center, beyond the visible window (for smooth fade at the clip edge)
const FAST_TIME_FRAC = 0.42; // ~42% of duration spent in the fast/blurred phase
const FAST_DIST_FRAC = 0.62; // ~62% of the distance covered during that fast phase
const TOTAL_MS = 6400;
const HOLD_MS = 450; // dramatic pause one name short of the winner
const FINAL_MS = 1200; // deliberately slow last name before it locks in

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function easeSlot(t: number): number {
  if (t <= FAST_TIME_FRAC) {
    const u = t / FAST_TIME_FRAC;
    return FAST_DIST_FRAC * (u < 0.25 ? 2 * u * u : u);
  }
  const u2 = (t - FAST_TIME_FRAC) / (1 - FAST_TIME_FRAC);
  const decel = 1 - Math.pow(1 - u2, 3);
  return FAST_DIST_FRAC + (1 - FAST_DIST_FRAC) * decel;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function buildStrip(names: string[], targetIndex: number): string[] {
  const target = names[targetIndex]!;
  const totalCrossings = Math.max(40, Math.min(90, names.length * 3));
  const loops = Math.max(4, Math.ceil(totalCrossings / names.length));
  const core: string[] = [];
  for (let l = 0; l < loops; l++) core.push(...shuffle(names));
  core[core.length - 1] = target;

  const padFront = Array.from({ length: RENDER_PAD }, () => names[Math.floor(Math.random() * names.length)]!);
  const padBack = Array.from({ length: RENDER_PAD }, () => names[Math.floor(Math.random() * names.length)]!);
  return [...padFront, ...core, ...padBack];
}

export default function SlotMachineReel({
  names,
  onSpinStart,
  onSpinEnd,
  resolveTarget,
  height = 360,
  idleLabel = "Nhấn Quay để bắt đầu",
  triggerLabel = "🎰 Quay",
}: SlotMachineReelProps) {
  const [phase, setPhase] = useState<"idle" | "resolving" | "spinning">("idle");
  const [settled, setSettled] = useState<{ name: string } | null>(null);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rafRef = useRef<number | null>(null);
  const rafTimeoutRef = useRef<number | null>(null);
  const animatingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastCenterIdxRef = useRef<number | null>(null);
  const lastFrameRef = useRef<{ pos: number; time: number } | null>(null);

  const itemHeight = height / VISIBLE_ROWS;
  const windowOffsets = Array.from({ length: RENDER_PAD * 2 + 1 }, (_, i) => i - RENDER_PAD);

  function ensureAudio() {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    } catch {
      // ignore — audio is a nice-to-have, never block the spin
    }
    return audioCtxRef.current;
  }

  function playTick(velocityRowsPerSec: number) {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const speedNorm = Math.min(velocityRowsPerSec / 18, 1); // 0 (slow) .. 1 (fast)
    const freq = 620 + speedNorm * 500;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = speedNorm > 0.5 ? "square" : "triangle";
    osc.frequency.setValueAtTime(freq, now);
    const peak = 0.05 + (1 - speedNorm) * 0.09;
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05 + (1 - speedNorm) * 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  function playLandChime() {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    [784, 988, 1174].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.14, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.35);
    });
  }

  function renderRow(idx: number, centerIdx: number, contPos: number, velocity: number) {
    const row = rowRefs.current[idx];
    if (!row) return;
    const offset = windowOffsets[idx]!;
    const rowDelta = offset - (contPos - centerIdx);
    const absD = Math.abs(rowDelta);

    const rotateX = Math.max(-70, Math.min(70, rowDelta * 16));
    const scale = Math.max(2 - absD * 0.5, 0.3);
    const opacity = Math.max(1 - absD * 0.32, 0.03);
    const translateZ = -absD * absD * 6;
    const blur = Math.min(velocity * 0.55 + absD * 1.1, 9);
    const bold = absD < 0.5;

    row.style.transform = `translateY(${offset * itemHeight}px) translateZ(${translateZ}px) rotateX(${rotateX}deg) scale(${scale})`;
    row.style.opacity = String(opacity);
    row.style.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : "none";
    row.style.fontWeight = bold ? "800" : "500";
    row.classList.toggle("reel-row-active", bold);
  }

  /** Runs one eased motion leg from `fromPos` to `toPos` (in row units), painting rows every frame. */
  function runSegment(strip: string[], fromPos: number, toPos: number, durationMs: number, ease: (t: number) => number): Promise<void> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      lastFrameRef.current = { pos: fromPos, time: startTime };

      function frame(now: number) {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / durationMs, 1);
        const contPos = fromPos + ease(t) * (toPos - fromPos);

        const last = lastFrameRef.current!;
        const dt = Math.max(now - last.time, 1);
        const velocity = ((contPos - last.pos) / dt) * 1000; // rows/sec
        lastFrameRef.current = { pos: contPos, time: now };

        const centerIdx = Math.round(contPos);
        if (centerIdx !== lastCenterIdxRef.current) {
          lastCenterIdxRef.current = centerIdx;
          playTick(Math.abs(velocity));
        }

        windowOffsets.forEach((offset, i) => {
          const row = rowRefs.current[i];
          if (!row) return;
          const stripIdx = centerIdx + offset;
          row.textContent = strip[Math.max(0, Math.min(strip.length - 1, stripIdx))] ?? "";
          renderRow(i, centerIdx, contPos, Math.abs(velocity));
        });

        if (t < 1) {
          rafRef.current = requestAnimationFrame(frame);
        } else {
          resolve();
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    });
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      rafTimeoutRef.current = window.setTimeout(resolve, ms);
    });
  }

  async function spinTo(pool: string[], targetIndex: number, winnerName: string) {
    const strip = buildStrip(pool, targetIndex);
    const startIdx = RENDER_PAD; // strip[RENDER_PAD] is centered at contPos=0
    const endIdx = strip.length - 1 - RENDER_PAD; // last "core" item, centered at contPos=totalDist
    const totalDist = endIdx - startIdx;

    for (const el of rowRefs.current) {
      if (el) el.textContent = "";
    }
    lastCenterIdxRef.current = null;

    if (totalDist < 1) {
      // Degenerate case (single candidate) — nothing to build suspense over.
      await runSegment(strip, startIdx, endIdx, TOTAL_MS, easeSlot);
    } else {
      // Leg 1: fast → decelerating, stopping one name short of the real winner.
      const decoyPos = endIdx - 1;
      await runSegment(strip, startIdx, decoyPos, TOTAL_MS, easeSlot);
      // Dramatic hold — "gần trúng rồi..." — then one last, deliberately slow name.
      playTick(2);
      await sleep(HOLD_MS);
      await runSegment(strip, decoyPos, endIdx, FINAL_MS, easeInOutCubic);
    }

    animatingRef.current = false;
    setPhase("idle");
    setSettled({ name: winnerName });
    playLandChime();
    onSpinEnd(winnerName, targetIndex);
  }

  async function handleTrigger() {
    if (animatingRef.current) return;
    ensureAudio();
    setSettled(null);

    let pool = names ?? [];
    let targetIndex: number;
    let winnerName: string;

    if (resolveTarget) {
      setPhase("resolving");
      const resolved = await resolveTarget();
      if (!resolved || resolved.names.length === 0) {
        setPhase("idle");
        return;
      }
      pool = resolved.names;
      targetIndex = resolved.index;
      winnerName = resolved.winner;
    } else {
      if (pool.length === 0) return;
      targetIndex = Math.floor(Math.random() * pool.length);
      winnerName = pool[targetIndex]!;
    }

    animatingRef.current = true;
    setPhase("spinning");
    onSpinStart?.();
    spinTo(pool, targetIndex, winnerName);
  }

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (rafTimeoutRef.current) window.clearTimeout(rafTimeoutRef.current);
    };
  }, []);

  const isBusy = phase !== "idle";
  const canSpin = resolveTarget ? true : (names?.length ?? 0) > 0;

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <style>{`
        @keyframes reelGlowPulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(217,119,6,0.55), 0 0 24px rgba(217,119,6,0.18); }
          50% { box-shadow: 0 0 0 2px rgba(217,119,6,0.9), 0 0 36px rgba(217,119,6,0.32); }
        }
        .reel-center-window { animation: reelGlowPulse 1.6s ease-in-out infinite; }
        .reel-row-active { color: #000000; }
      `}</style>

      <div
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border-2 border-token bg-white"
        style={{ height, perspective: "700px", perspectiveOrigin: "50% 50%" }}
      >
        {/* fade masks top/bottom */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1/3 bg-gradient-to-b from-white to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-1/3 bg-gradient-to-t from-white to-transparent" />

        {/* center indicator window */}
        <div
          className="reel-center-window pointer-events-none absolute inset-x-3 z-10 rounded-lg border-y-2 border-amber-500 bg-amber-50/70"
          style={{ top: (height - itemHeight) / 2, height: itemHeight }}
        />
        {/* pointer chevrons */}
        <div
          className="pointer-events-none absolute left-0 z-20 text-amber-600"
          style={{ top: height / 2 - 10 }}
        >
          ▶
        </div>
        <div
          className="pointer-events-none absolute right-0 z-20 text-amber-600"
          style={{ top: height / 2 - 10 }}
        >
          ◀
        </div>

        <div
          className="absolute inset-x-0"
          style={{ top: height / 2, transformStyle: "preserve-3d" }}
        >
          {windowOffsets.map((offset, i) => (
            <div
              key={i}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              className="absolute inset-x-0 flex items-center justify-center whitespace-nowrap px-4 text-center text-gray-900 transition-none"
              style={{
                height: itemHeight,
                marginTop: -itemHeight / 2,
                fontSize: Math.max(14, itemHeight * 0.34),
                transform: `translateY(${offset * itemHeight}px)`,
                opacity: offset === 0 ? 1 : 0.3,
              }}
            />
          ))}
        </div>

        {phase === "idle" && !settled && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 text-center px-6">
            <p className="text-sm text-gray-500">{idleLabel}</p>
          </div>
        )}
        {phase === "resolving" && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70">
            <p className="text-sm text-gray-500 animate-pulse">Đang chuẩn bị...</p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleTrigger}
        disabled={isBusy || !canSpin}
        className="btn-primary btn-lg w-full max-w-xl disabled:cursor-not-allowed disabled:opacity-60"
      >
        {phase === "resolving" ? "Đang chuẩn bị..." : phase === "spinning" ? "Đang quay..." : triggerLabel}
      </button>
    </div>
  );
}
