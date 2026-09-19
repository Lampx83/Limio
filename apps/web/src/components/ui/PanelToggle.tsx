"use client";

import { ChevronsLeft, ChevronsRight } from "lucide-react";

// Nút gấp/mở thanh bên — 1 kiểu duy nhất cho mọi panel (menu module, danh sách
// slide, cài đặt slide) để GV nhận ra ngay là "nút thu gọn". `side` là phía
// panel đang đứng: panel trái gấp = mũi tên chỉ trái, panel phải gấp = chỉ phải.
export default function PanelToggle({
  side,
  collapsed,
  onClick,
  label,
  className = "",
}: {
  side: "left" | "right";
  collapsed: boolean;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  const pointsLeft = side === "left" ? !collapsed : collapsed;
  const Icon = pointsLeft ? ChevronsLeft : ChevronsRight;
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-expanded={!collapsed}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-token bg-[rgb(var(--surface))] text-muted shadow-sm transition hover:border-brand-300 hover:text-brand-700 ${className}`}
    >
      <Icon size={14} strokeWidth={2.4} />
    </button>
  );
}
