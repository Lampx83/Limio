"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const WHEEL_COLORS = [
  "#EF4444", // red
  "#F97316", // orange
  "#FACC15", // yellow
  "#22C55E", // green
  "#06B6D4", // cyan
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
];

interface LuckyWheelProps {
  names: string[];
  isSpinning: boolean;
  onSpinStart: () => void;
  onSpinEnd: (winner: string, index: number) => void;
  size?: number;
}

export default function LuckyWheel({
  names,
  isSpinning,
  onSpinStart,
  onSpinEnd,
  size = 480,
}: LuckyWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const tickTimersRef = useRef<number[]>([]);

  const N = Math.max(names.length, 1);
  const segAngle = 360 / N;
  const radius = size / 2;
  const cx = radius;
  const cy = radius;

  const segments = useMemo(() => {
    return names.map((name, i) => {
      const startAngle = i * segAngle - 90; // start at top
      const endAngle = startAngle + segAngle;
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      const x1 = cx + radius * Math.cos(startRad);
      const y1 = cy + radius * Math.sin(startRad);
      const x2 = cx + radius * Math.cos(endRad);
      const y2 = cy + radius * Math.sin(endRad);
      const largeArc = segAngle > 180 ? 1 : 0;
      const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const midAngle = startAngle + segAngle / 2;
      const color = WHEEL_COLORS[i % WHEEL_COLORS.length];
      return { path, color, midAngle, name, i };
    });
  }, [names, segAngle, cx, cy, radius]);

  const fontSize = useMemo(() => {
    if (N <= 8) return 22;
    if (N <= 16) return 18;
    if (N <= 24) return 15;
    if (N <= 40) return 12;
    return 10;
  }, [N]);

  const maxTextLen = useMemo(() => {
    if (N <= 8) return 18;
    if (N <= 16) return 14;
    if (N <= 24) return 12;
    return 10;
  }, [N]);

  function playStartSound() {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }
    } catch {
      // ignore
    }
  }

  function playTick(phase: number) {
    // phase ∈ [0,1]: 0 = lúc mới quay (nhanh, pitch cao), 1 = sắp dừng (chậm, pitch thấp)
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const freq = 1200 - phase * 700; // 1200Hz → 500Hz
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = phase < 0.6 ? "square" : "triangle"; // gắt khi nhanh, dày khi chậm
    osc.frequency.setValueAtTime(freq, now);
    const peak = 0.06 + phase * 0.08; // càng chậm càng to → cảm giác ratcheting
    const decay = 0.04 + phase * 0.12;
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + decay);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + decay + 0.02);
  }

  function playWinSound() {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0.15, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.3);
    });
  }

  function clearTickTimers() {
    tickTimersRef.current.forEach((id) => clearTimeout(id));
    tickTimersRef.current = [];
  }

  function scheduleTicks(durationMs: number, totalSegmentsPassed: number) {
    // Tick mỗi khi pointer "đi qua" 1 múi. Dùng cùng ease-out của CSS để khớp với hình.
    const ticks = Math.min(totalSegmentsPassed, 80);
    for (let i = 1; i <= ticks; i++) {
      const t = i / ticks;
      // ease-out-cubic ≈ cubic-bezier(0.17, 0.67, 0.12, 0.99)
      const eased = 1 - Math.pow(1 - t, 3);
      const delay = eased * durationMs;
      const phase = t; // 0 = đầu (nhanh), 1 = cuối (chậm)
      const id = window.setTimeout(() => playTick(phase), delay);
      tickTimersRef.current.push(id);
    }
  }

  function spin() {
    if (isSpinning || names.length === 0) return;
    playStartSound();
    onSpinStart();
    setWinnerIndex(null);

    const targetIndex = Math.floor(Math.random() * names.length);
    const targetMid = targetIndex * segAngle + segAngle / 2;
    // After rotation R, segment center sits at (targetMid + R) measured clockwise from top.
    // Pointer is at top → want (targetMid + R) ≡ 0 (mod 360) → R ≡ -targetMid (mod 360).
    const extraTurns = 6 + Math.floor(Math.random() * 3); // 6-8 turns
    const currentMod = ((rotation % 360) + 360) % 360;
    const desiredMod = (360 - targetMid + 360) % 360;
    // jitter inside the slice so it doesn't land dead-center every time
    const jitter = (Math.random() - 0.5) * (segAngle * 0.6);
    let delta = desiredMod - currentMod + jitter;
    if (delta < 0) delta += 360;
    const newRotation = rotation + extraTurns * 360 + delta;
    const durationMs = 5200;
    setRotation(newRotation);

    clearTickTimers();
    scheduleTicks(durationMs, extraTurns * names.length);

    window.setTimeout(() => {
      setWinnerIndex(targetIndex);
      playWinSound();
      onSpinEnd(names[targetIndex]!, targetIndex);
    }, durationMs);
  }

  useEffect(() => {
    return () => clearTickTimers();
  }, []);

  function truncate(s: string) {
    return s.length > maxTextLen ? s.slice(0, maxTextLen - 1) + "…" : s;
  }

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div
        className="relative"
        style={{ width: size, height: size, maxWidth: "90vw" }}
      >
        {/* Pointer (drop shape) at top */}
        <div
          className="absolute left-1/2 -translate-x-1/2 z-10"
          style={{ top: -6 }}
          aria-hidden
        >
          <svg width="36" height="48" viewBox="0 0 36 48">
            <path
              d="M18 46 C 6 32, 2 22, 2 14 a 16 16 0 1 1 32 0 c 0 8 -4 18 -16 32 Z"
              fill="#111827"
              stroke="#fff"
              strokeWidth="2"
            />
          </svg>
        </div>

        {/* Wheel */}
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width="100%"
          height="100%"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: isSpinning
              ? "transform 5.2s cubic-bezier(0.17, 0.67, 0.12, 0.99)"
              : "none",
            filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.15))",
          }}
        >
          {/* outer ring */}
          <circle cx={cx} cy={cy} r={radius - 1} fill="#fff" />
          {segments.map((seg) => {
            // Text dọc theo bán kính: đặt ở giữa múi, anchor ở đầu ngoài, hướng vào tâm.
            // Với các múi nửa dưới (mid ∈ (0°, 180°) sau khi cộng 90° offset), lật 180° để chữ không ngược.
            // seg.midAngle đã trừ 90° (top = -90). Quy về [0, 360):
            const textX = cx + radius * 0.58;
            return (
              <g key={seg.i}>
                <path d={seg.path} fill={seg.color} stroke="#fff" strokeWidth={2} />
                <g
                  transform={`rotate(${seg.midAngle} ${cx} ${cy})`}
                  style={{ pointerEvents: "none" }}
                >
                  <text
                    x={textX}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={fontSize}
                    fontWeight={700}
                    fill="#111827"
                  >
                    {truncate(seg.name)}
                  </text>
                </g>
              </g>
            );
          })}
          {/* outer border */}
          <circle
            cx={cx}
            cy={cy}
            r={radius - 2}
            fill="none"
            stroke="#fff"
            strokeWidth={4}
          />
        </svg>

        {/* Center Spin button */}
        <button
          type="button"
          onClick={spin}
          disabled={isSpinning || names.length === 0}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 rounded-full bg-gray-900 text-white font-bold shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
          style={{
            width: size * 0.18,
            height: size * 0.18,
            fontSize: size * 0.05,
          }}
          aria-label="Spin the wheel"
        >
          {isSpinning ? "..." : "Spin"}
        </button>
      </div>

      {winnerIndex !== null && !isSpinning && (
        <div className="mt-6 text-center">
          <p className="text-sm text-muted uppercase tracking-wider">Trúng</p>
          <p className="mt-1 text-3xl font-extrabold text-brand-700">
            {names[winnerIndex]}
          </p>
        </div>
      )}
    </div>
  );
}
