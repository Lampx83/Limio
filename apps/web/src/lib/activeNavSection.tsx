"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

/**
 * InstructorLeftMenu suy ra mục menu đang active từ pathname bằng regex — đủ
 * dùng cho hầu hết route, nhưng vỡ ở những route mà CÙNG MỘT path pattern
 * phục vụ hai nhóm menu khác nhau tuỳ dữ liệu (vd
 * /instructor/courses/[id]/exams/[examId]/* phục vụ cả đề thi viết lẫn đề
 * vấn đáp — chỉ `exam.kind` mới biết, và kind đó chỉ server component mới có
 * sẵn). Context này cho phép một page/layout server-side "ghi đè" mục active
 * bằng chính `href` của item cần sáng (khớp `Item.href` trong
 * InstructorLeftMenu), qua component con
 * `<SetActiveNavSection href="/instructor/oral-exams" />`.
 */
const ActiveNavSectionContext = createContext<{
  value: string | null;
  set: (v: string | null) => void;
} | null>(null);

export function ActiveNavSectionProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <ActiveNavSectionContext.Provider value={{ value, set: setValue }}>
      {children}
    </ActiveNavSectionContext.Provider>
  );
}

export function useActiveNavSectionOverride(): string | null {
  const ctx = useContext(ActiveNavSectionContext);
  return ctx?.value ?? null;
}

/** Render bên trong 1 page/layout để báo menu bên trái highlight item có `href` này thay vì suy theo pathname. Tự dọn lại khi unmount (điều hướng đi trang khác). */
export function SetActiveNavSection({ href }: { href: string }) {
  const ctx = useContext(ActiveNavSectionContext);
  // Giữ ref để cleanup effect không phụ thuộc identity của `ctx.set`.
  const setRef = useRef(ctx?.set);
  setRef.current = ctx?.set;

  useEffect(() => {
    setRef.current?.(href);
    return () => setRef.current?.(null);
  }, [href]);

  return null;
}
