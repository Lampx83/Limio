"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 10; // ~20s — Stripe webhook thường xong trong vài giây.

/**
 * Hiện ngay sau khi Stripe redirect về `/learn/[slug]?paid=1` nhưng webhook
 * `checkout.session.completed` (chạy song song, không đồng bộ với redirect)
 * chưa kịp tạo/gia hạn Enrollment. Poll enroll-status; khi thấy enrolled thì
 * reload để trang server-side render lại đúng nội dung khoá học.
 */
export default function PaymentProcessingNotice({ slug }: { slug: string }) {
  const [attempts, setAttempts] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (attempts >= MAX_ATTEMPTS) {
      setTimedOut(true);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(apiUrl(`/api/courses/${slug}/enroll-status`));
      const data = await res.json().catch(() => ({}));
      if (data?.enrolled) {
        window.location.href = `/learn/${slug}`;
        return;
      }
      setAttempts((a) => a + 1);
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [attempts, slug]);

  if (timedOut) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="h-display text-xl font-bold">Thanh toán đang được xử lý</h1>
        <p className="mt-2 text-sm text-muted">
          Việc này thường chỉ mất vài giây, nhưng hơi lâu hơn dự kiến. Nếu tải lại trang
          sau ít phút vẫn chưa vào được khoá, vui lòng liên hệ hỗ trợ kèm mã giao dịch
          Stripe trong email xác nhận.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="h-display text-xl font-bold">Thanh toán thành công</h1>
      <p className="mt-2 text-sm text-muted">Đang kích hoạt quyền truy cập khoá học…</p>
    </main>
  );
}
