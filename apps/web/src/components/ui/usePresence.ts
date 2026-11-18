"use client";

import { useEffect, useState } from "react";

/**
 * Giữ một thành phần được dựng thêm `ms` mili giây sau khi `open` về false, để kịp chạy hoạt ảnh thoát (bảng nổi, ngăn kéo).
 * `mounted` = có nên dựng; `leaving` = đang thoát (đặt lớp hoạt ảnh thoát). Lần dựng đầu theo `open`, không phát hoạt ảnh thoát.
 */
export function usePresence(open: boolean, ms = 180): { mounted: boolean; leaving: boolean } {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(timer);
  }, [open, ms]);
  return { mounted: open || mounted, leaving: !open && mounted };
}
