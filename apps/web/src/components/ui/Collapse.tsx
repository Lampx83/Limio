"use client";

import { useEffect, useState } from "react";

/** Thời gian mở/thu (ms); khớp với `.collapse` trong globals.css. */
export const COLLAPSE_MS = 220;

/**
 * Mở/thu một khối theo chiều cao, mượt: hàng lưới đổi 0fr ↔ 1fr (không cần đo chiều cao nên nội dung đổi kích thước lúc đang mở vẫn đúng) kèm mờ dần.
 * Khối đang thu: ẩn khỏi trình đọc màn hình và bàn phím (`aria-hidden`, `inert`, `visibility` đổi sau khi thu xong). Giảm chuyển động hệ thống thì đổi tức thì.
 * `lazy`: chỉ dựng nội dung khi đang mở hoặc đang thu (khối nặng hoặc có test mong nội dung không có khi đóng); không lazy thì nội dung luôn nằm trong trang.
 * Khi mở xong, bỏ `overflow: hidden` để bóng, viền focus, popover của nội dung không bị cắt.
 */
export default function Collapse({
  open,
  id,
  className,
  testId,
  lazy = false,
  children,
}: {
  open: boolean;
  id?: string;
  className?: string;
  testId?: string;
  lazy?: boolean;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [settled, setSettled] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const timer = setTimeout(() => setSettled(true), COLLAPSE_MS + 30);
      return () => clearTimeout(timer);
    }
    setSettled(false);
    const timer = setTimeout(() => setMounted(false), COLLAPSE_MS + 40);
    return () => clearTimeout(timer);
  }, [open]);
  // `inert` chưa có trong kiểu của React 18: đặt qua spread; chuỗi rỗng là thuộc tính có mặt.
  const inert = open ? {} : ({ inert: "" } as Record<string, string>);
  return (
    <div id={id} data-testid={testId} data-open={open ? "" : undefined} aria-hidden={open ? undefined : true} className={`collapse ${className ?? ""}`} {...inert}>
      <div className={`min-h-0 ${open && settled ? "" : "overflow-hidden"}`}>{!lazy || open || mounted ? children : null}</div>
    </div>
  );
}
