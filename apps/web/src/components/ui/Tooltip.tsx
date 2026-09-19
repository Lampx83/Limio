"use client";

// Tooltip CSS thuần (hiện khi rê chuột hoặc focus bàn phím) — nhanh và có mô tả
// 2 dòng, thay cho thuộc tính `title` của trình duyệt (trễ ~1s, không định dạng).
export default function Tooltip({
  label,
  description,
  align = "center",
  children,
}: {
  label: string;
  description?: string;
  align?: "center" | "end";
  children: React.ReactNode;
}) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-50 mt-2 w-max max-w-[240px] rounded-lg bg-[#20241F] px-3 py-2 text-left text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${
          align === "end" ? "right-0" : "left-1/2 -translate-x-1/2"
        }`}
      >
        <span className="block text-xs font-semibold leading-tight">{label}</span>
        {description && <span className="mt-0.5 block text-[11px] leading-snug text-white/70">{description}</span>}
      </span>
    </span>
  );
}
