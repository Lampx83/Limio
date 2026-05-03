// Simple SVG charts (no dependency)
import React from "react";

export function DonutChart({
  value,
  max = 100,
  size = 120,
  strokeWidth = 12,
  label,
  color = "#3b82f6",
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const dash = (pct / 100) * circumference;
  return (
    <div className="inline-flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-slate-200 dark:text-slate-700"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <div
        className="-mt-[calc(50%+10px)] mb-[calc(50%-10px)] text-center"
        style={{ width: size }}
      >
        <p className="text-xl font-bold">{Math.round(pct)}%</p>
        {label && <p className="text-xs text-slate-500">{label}</p>}
      </div>
    </div>
  );
}

export function BarChart({
  data,
  height = 100,
  color = "#3b82f6",
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => (
        <div
          key={i}
          className="flex-1 flex flex-col items-center gap-0.5"
          style={{ minWidth: 0 }}
        >
          <div className="text-[10px] text-slate-500">{d.value}</div>
          <div
            className="w-full rounded-t transition-all"
            style={{
              height: `${(d.value / max) * (height - 30)}px`,
              minHeight: 2,
              backgroundColor: color,
            }}
            title={`${d.label}: ${d.value}`}
          />
          <div className="text-[10px] text-slate-500 truncate w-full text-center">
            {d.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PrePostBar({
  pre,
  post,
  max = 5,
  label,
}: {
  pre: number | null;
  post: number | null;
  max?: number;
  label: string;
}) {
  const prePct = pre ? (pre / max) * 100 : 0;
  const postPct = post ? (post / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span>
          {pre !== null ? pre : "—"} → {post !== null ? post : "—"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 items-center">
        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className="h-full bg-slate-400"
            style={{ width: `${prePct}%` }}
            title={`Pre: ${pre}`}
          />
        </div>
        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${postPct}%` }}
            title={`Post: ${post}`}
          />
        </div>
      </div>
    </div>
  );
}
