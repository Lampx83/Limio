"use client";

import type { BloomMix } from "../useWizardState";

interface Props {
  value: BloomMix;
  onChange: (next: BloomMix) => void;
}

const LABELS: Record<keyof BloomMix, string> = {
  remember_understand: "Nhớ & Hiểu",
  apply: "Vận dụng",
  analyze_plus: "Phân tích trở lên",
};

const COLORS: Record<keyof BloomMix, string> = {
  remember_understand: "bg-blue-500",
  apply: "bg-green-500",
  analyze_plus: "bg-purple-500",
};

type Key = keyof BloomMix;
const KEYS: Key[] = ["remember_understand", "apply", "analyze_plus"];

/** Adjust `key` to `next` value, distributing the delta proportionally to others. */
function rebalance(mix: BloomMix, key: Key, next: number): BloomMix {
  const delta = next - mix[key];
  const others = KEYS.filter((k) => k !== key);
  const otherSum = others.reduce((a, k) => a + mix[k], 0);
  const updated = { ...mix, [key]: next } as BloomMix;
  if (otherSum === 0) {
    // Distribute evenly
    const share = Math.round(-delta / 2);
    others.forEach((k) => { updated[k] = Math.max(0, mix[k] + share); });
  } else {
    others.forEach((k) => {
      updated[k] = Math.max(0, Math.round(mix[k] - delta * (mix[k] / otherSum)));
    });
  }
  // Fix rounding: ensure total = 100
  const total = KEYS.reduce((a, k) => a + updated[k], 0);
  const diff = 100 - total;
  if (diff !== 0) {
    const adjust = others.find((k) => updated[k] + diff >= 0) ?? key;
    updated[adjust] = updated[adjust] + diff;
  }
  return updated;
}

export default function BloomSlider({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      {/* Visual bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {KEYS.map((k) => (
          <div
            key={k}
            className={`${COLORS[k]} transition-all`}
            style={{ width: `${value[k]}%` }}
          />
        ))}
      </div>

      {/* Sliders */}
      {KEYS.map((k) => (
        <div key={k} className="flex items-center gap-3">
          <div className={`h-3 w-3 flex-shrink-0 rounded-full ${COLORS[k]}`} />
          <span className="w-40 text-sm">{LABELS[k]}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={value[k]}
            onChange={(e) => onChange(rebalance(value, k, Number(e.target.value)))}
            className="flex-1 accent-blue-600"
          />
          <span className="w-10 text-right text-sm font-medium">{value[k]}%</span>
        </div>
      ))}
      <p className="text-xs text-faint">Kéo một thanh, hai thanh còn lại tự điều chỉnh về 100%</p>
    </div>
  );
}
