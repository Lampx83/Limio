import type { ReactNode } from "react";

/** Tên hiển thị của giảng viên ảo trên thanh phát (một chỗ để đổi). */
export const LECTURER_NAME = "Giảng viên ảo";

/** Sóng âm: bốn thanh nhún khi đang nói (xem narration.css; đứng yên khi giảm chuyển động). */
export function NarrationWave({ playing, className = "" }: { playing: boolean; className?: string }) {
  return (
    <span className={`narration-wave ${className}`} data-playing={playing ? "1" : "0"} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

const HOST_STYLE = {
  A: "bg-indigo-600",
  B: "bg-amber-600",
} as const;

/**
 * Ảnh đại diện. Giảng viên ảo là hình người vẽ bằng SVG (không phải ảnh tải về, nên không có giấy phép phải dẫn và
 * không tốn một lượt tải); người dẫn podcast là chữ cái đầu tên trên nền màu riêng để phân biệt hai người.
 */
export function NarrationAvatar({
  who,
  name,
  speaking = false,
  size = "md",
  className = "",
}: {
  who: "lecturer" | "A" | "B";
  name?: string;
  speaking?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const dim = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const ring = speaking ? "narration-speaking" : "";
  let inner: ReactNode;
  if (who === "lecturer") {
    inner = (
      <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="narration-avatar-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#65a30d" />
            <stop offset="1" stopColor="#0d9488" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" fill="url(#narration-avatar-bg)" />
        <circle cx="20" cy="15.5" r="6.5" fill="#fff" fillOpacity="0.95" />
        <path d="M6.5 40c0-8.3 6-13.5 13.5-13.5S33.5 31.7 33.5 40Z" fill="#fff" fillOpacity="0.95" />
      </svg>
    );
  } else {
    const initial = (name ?? who).trim().charAt(0).toUpperCase() || who;
    inner = (
      <span className={`flex h-full w-full items-center justify-center text-sm font-bold text-white ${HOST_STYLE[who]}`} aria-hidden="true">
        {initial}
      </span>
    );
  }
  return (
    <span className={`inline-block shrink-0 overflow-hidden rounded-full ${dim} ${ring} ${className}`} role="img" aria-label={name ?? LECTURER_NAME}>
      {inner}
    </span>
  );
}
