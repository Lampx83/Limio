"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Phản hồi tức thì khi chuyển bài/tab trong course editor.
 *
 * Đổi bài chỉ đổi tham số URL trên cùng một route nên Next không hiện
 * loading.tsx — người soạn bấm xong thấy đứng hình vài trăm ms. Component này
 * bắt cú bấm vào link nội bộ của editor, chạy thanh tiến trình mảnh trên đầu
 * trang và làm mờ nhẹ vùng nội dung (`data-editor-body`) cho tới khi URL đổi.
 */
export default function EditorNavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, setPending] = useState(false);
  const [width, setWidth] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // URL đổi = trang mới đã sẵn sàng.
  useEffect(() => {
    if (!pending) return;
    setWidth(100);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setPending(false);
      setWidth(0);
    }, 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      if (!url.pathname.startsWith("/instructor/courses/")) return;
      setPending(true);
      setWidth(0);
      requestAnimationFrame(() => requestAnimationFrame(() => setWidth(85)));
      // Chốt an toàn: lỗi mạng/redirect thì không kẹt thanh tiến trình.
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setPending(false);
        setWidth(0);
      }, 15000);
    };
    // Capture: Next <Link> gọi preventDefault ở pha bubble nên bắt sau là bị bỏ qua.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-editor-body]");
    if (!el) return;
    el.style.opacity = pending ? "0.6" : "";
    el.style.transition = "opacity 150ms";
    return () => {
      el.style.opacity = "";
    };
  }, [pending]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5"
      style={{ opacity: pending ? 1 : 0, transition: "opacity 200ms" }}
    >
      <div
        className="h-full bg-lime-600"
        style={{
          width: `${width}%`,
          transition: width === 85 ? "width 6s cubic-bezier(0.1, 0.6, 0.2, 1)" : width === 100 ? "width 150ms" : "none",
        }}
      />
    </div>
  );
}
