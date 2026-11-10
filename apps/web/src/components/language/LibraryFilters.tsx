"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";

/**
 * Khung bộ lọc của Thư viện giáo trình: từ `md` luôn mở; dưới `md` thu thành một khối mở/đóng (mở sẵn khi đang lọc).
 * Chỉ bọc phần hiển thị — các ô là form GET thật, chạy được cả khi chưa có JavaScript.
 */
export default function LibraryFilters({ defaultOpen, children }: { defaultOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="btn-ghost btn-sm inline-flex items-center gap-1.5 md:hidden"
      >
        <SlidersHorizontal size={14} aria-hidden /> Bộ lọc
      </button>
      <div className={`${open ? "block" : "hidden"} mt-3 md:mt-0 md:block`}>{children}</div>
    </div>
  );
}
