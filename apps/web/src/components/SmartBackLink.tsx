"use client";

import Link from "next/link";

/**
 * "← Quay lại" đưa người dùng về đúng trang họ vừa đến, thay vì một trang cố định.
 *
 * Trước đây nút ghi "← Course detail" (tiếng Anh) và luôn dẫn sang trang giới thiệu
 * khoá, dù người học vào từ trang tổng quan. Nếu trang trước là của chính ứng dụng
 * thì quay lại đúng đó; mở thẳng từ liên kết hoặc tab mới thì dùng `fallbackHref`.
 */
export default function SmartBackLink({
  fallbackHref,
  label = "Quay lại",
  className = "link inline-flex items-center gap-1 text-sm",
}: {
  fallbackHref: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={fallbackHref}
      className={className}
      onClick={(e) => {
        try {
          const ref = document.referrer;
          if (ref && new URL(ref).origin === window.location.origin && window.history.length > 1) {
            e.preventDefault();
            window.history.back();
          }
        } catch {
          // Không đọc được trang trước: cứ đi theo liên kết dự phòng.
        }
      }}
    >
      ← {label}
    </Link>
  );
}
