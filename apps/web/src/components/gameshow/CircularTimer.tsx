"use client";

// Vòng đếm ngược dạng SVG — đổi màu Xanh (brand) -> Hổ phách -> Đỏ khi gấp,
// pulse ở 5s cuối. Dùng chung cho host (to, giữa màn hình) và học viên (nhỏ,
// trên header). Thuần trình bày — không đụng vào timer logic thực (đến từ
// currentQuestionStartedAt/timeLimitMs của caller).

export function CircularTimer({
  remainingMs,
  totalMs,
  size = 96,
  strokeWidth = 8,
  className = "",
}: {
  remainingMs: number;
  totalMs: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const fraction = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - fraction);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const urgent = fraction <= 0.25;
  const warn = fraction <= 0.5 && !urgent;
  const color = urgent ? "#f87171" : warn ? "#fbbf24" : "#84cc16";

  return (
    <div
      className={`relative inline-flex items-center justify-center ${urgent ? "gs-timer-urgent" : ""} ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.2s linear, stroke 0.3s ease" }}
        />
      </svg>
      <span
        className="absolute font-mono font-black tabular-nums"
        style={{ fontSize: size * 0.32, color }}
      >
        {remainingSec}
      </span>
    </div>
  );
}
