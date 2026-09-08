"use client";

import { useState } from "react";
import { isFree } from "@/lib/formatPrice";
import EnrollButton from "./EnrollButton";

/**
 * Nút hành động cho banner "Bạn chưa đăng ký khoá học này" trên trang catalog.
 *
 * Khoá miễn phí: bấm là ghi danh ngay (render thẳng EnrollButton — cùng một
 * cú bấm, không có bước trung gian).
 *
 * Khoá có phí: bấm "Đăng ký ngay" chỉ MỞ RA ô giá + nhập mã kích hoạt ngay
 * tại banner — không cuộn trang xuống sidebar, không phụ thuộc sidebar có
 * hiển thị hay không (mobile ẩn sidebar). Giữ hai bước riêng cho khoá có phí
 * vì EnrollButton bản trả phí là cả một khối (giá + input + nút) — hiện sẵn
 * ngay trong dòng banner sẽ nặng nề ngay từ đầu, trong khi phần lớn người
 * ghé qua chỉ cần đọc câu nhắc trước đã.
 */
export default function EnrollNudgeAction({
  slug,
  priceCents,
  currency,
  paymentEnabled,
}: {
  slug: string;
  priceCents?: number | null;
  currency?: string;
  paymentEnabled?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const free = !paymentEnabled || isFree(priceCents);

  // Khoá miễn phí: button gọn, nằm cùng dòng với câu nhắc.
  if (free) {
    return (
      <EnrollButton
        slug={slug}
        alreadyEnrolled={false}
        priceCents={priceCents}
        currency={currency}
        paymentEnabled={paymentEnabled}
        freeLabel="Đăng ký ngay"
      />
    );
  }

  // Khoá có phí, đã bấm mở: EnrollButton bản trả phí là cả một khối (giá +
  // input mã + nút) — cho nó xuống hẳn dòng riêng, rộng hết cỡ, thay vì ép
  // vào phần còn lại của dòng banner.
  if (revealed) {
    return (
      <div className="mt-1 w-full sm:w-80">
        <EnrollButton
          slug={slug}
          alreadyEnrolled={false}
          priceCents={priceCents}
          currency={currency}
          paymentEnabled={paymentEnabled}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className="btn-primary btn-sm shrink-0"
    >
      Đăng ký ngay
    </button>
  );
}
