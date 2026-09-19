"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Menu, Home } from "lucide-react";
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
  const searchParams = useSearchParams();
  if (!shouldShow(pathname)) return null;
  // Giảng viên xem thử bài (?preview=1): trang chỉ còn tên bài + nội dung.
  if (searchParams.get("preview") === "1") return null;

  const dispatch = () =>
    window.dispatchEvent(new CustomEvent(STUDENT_MENU_TOGGLE_EVENT));

  if (variant === "floating") {
    // Lối thoát nhanh khỏi trang bài học dài — về thẳng dashboard thay vì mở
    // cả một menu, nhất quán với 3 nút nổi bên phải (mục lục/ghi chú/AI tutor)
    // vốn đều là hành động một điểm đến. Menu đầy đủ vẫn còn ở header.
    //
    // ?gv=1 là giảng viên đang trình chiếu (chế độ giảng dạy) mượn URL của
    // học viên — Home lúc này phải về dashboard giảng viên, không phải
    // dashboard học viên (tài khoản đang xem có thể không có enrollment nào).
    const teaching = searchParams.get("gv") === "1";
    return (
      <Link
        href={teaching ? "/instructor/dashboard" : "/me/dashboard"}
        aria-label={teaching ? "Về dashboard giảng viên" : "Về trang chủ học viên"}
        className={`fixed bottom-24 left-4 z-30 flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 ${
          // Cùng tông với left menu tương ứng: giảng viên hổ phách (xem
          // InstructorLeftMenu), học viên xanh ngọc (xem StudentLeftMenu).
          teaching ? "bg-amber-500" : "bg-emerald-500"
        }`}
      >
        <Home size={18} />
      </Link>
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
