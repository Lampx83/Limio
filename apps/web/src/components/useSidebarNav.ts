"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// useLayoutEffect cảnh báo khi SSR; ở server thì dùng useEffect (không chạy).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Sidebar của /admin và /me là 2 layout khác nhau nên remount khi người dùng
// chuyển qua lại. Giữ trạng thái thu gọn ở module để lần mount sau vẽ đúng ngay
// ở frame đầu, không phải đợi đọc localStorage (nếu không: nhóm đã thu gọn bung
// ra rồi mới co lại — cảm giác "giật").
const collapsedCache = new Map<string, Record<string, boolean>>();

// Nếu điều hướng không kết thúc (lỗi mạng, bị huỷ) thì thôi tô sáng mục đã bấm.
const PENDING_TIMEOUT_MS = 8000;

/**
 * Hành vi dùng chung của sidebar admin / học viên:
 *  - trạng thái thu gọn nhóm lưu localStorage (không nháy khi remount),
 *  - prefetch khi rê chuột / focus / chạm — tải sẵn khung `loading.tsx` của
 *    trang đích nên bấm xong thấy skeleton ngay thay vì đứng yên chờ server,
 *    mà không prefetch hàng loạt theo viewport như `prefetch` mặc định,
 *  - phản hồi tức thì: mục vừa bấm sáng lên ngay (optimistic), không đợi URL đổi.
 */
export function useSidebarNav(storageKey: string) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    () => collapsedCache.get(storageKey) ?? {},
  );
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const prefetched = useRef(new Set<string>());

  useIsoLayoutEffect(() => {
    if (collapsedCache.has(storageKey)) return;
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      collapsedCache.set(storageKey, parsed);
      setCollapsed(parsed);
    } catch {
      collapsedCache.set(storageKey, {});
    }
  }, [storageKey]);

  // URL đã đổi → điều hướng xong.
  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    if (!pendingHref) return;
    const t = setTimeout(() => setPendingHref(null), PENDING_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [pendingHref]);

  const toggle = useCallback(
    (id: string) => {
      setCollapsed((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        collapsedCache.set(storageKey, next);
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [storageKey],
  );

  const prefetch = useCallback(
    (href: string) => {
      if (prefetched.current.has(href)) return;
      prefetched.current.add(href);
      router.prefetch(href);
    },
    [router],
  );

  /** Props rải vào `<Link>` của mỗi mục menu. `onNavigate` chạy thêm khi bấm. */
  const linkProps = useCallback(
    (href: string, onNavigate?: () => void) => ({
      prefetch: false as const,
      onMouseEnter: () => prefetch(href),
      onFocus: () => prefetch(href),
      onTouchStart: () => prefetch(href),
      onClick: (e: React.MouseEvent) => {
        onNavigate?.();
        // Bấm kèm Ctrl/Cmd/Shift hoặc chuột giữa = mở tab mới, không điều hướng ở đây.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        if (href !== pathname) setPendingHref(href);
      },
    }),
    [prefetch, pathname],
  );

  return { pathname, collapsed, toggle, pendingHref, linkProps };
}
