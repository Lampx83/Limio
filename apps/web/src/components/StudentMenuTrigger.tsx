"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { STUDENT_MENU_TOGGLE_EVENT } from "./StudentLeftMenu";

type Variant = "header" | "floating";

const PATH_PREFIXES = ["/me", "/learn/"];

function shouldShow(pathname: string): boolean {
  return PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export default function StudentMenuTrigger({
  variant = "header",
}: {
  variant?: Variant;
}) {
  const pathname = usePathname();
  if (!shouldShow(pathname)) return null;

  const dispatch = () =>
    window.dispatchEvent(new CustomEvent(STUDENT_MENU_TOGGLE_EVENT));

  if (variant === "floating") {
    return (
      <button
        type="button"
        onClick={dispatch}
        aria-label="Mở menu học viên"
        className="fixed bottom-4 left-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition-transform hover:scale-105"
      >
        <Menu size={18} />
      </button>
    );
  }

  // header variant: visible only below lg (desktop has sidebar)
  return (
    <button
      type="button"
      onClick={dispatch}
      aria-label="Mở menu học viên"
      className="flex h-9 w-9 items-center justify-center rounded-lg text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-muted))] lg:hidden"
    >
      <Menu size={18} />
    </button>
  );
}
