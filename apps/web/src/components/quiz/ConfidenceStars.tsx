"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/dict";

/**
 * Thang độ tự tin 1–5 dưới dạng sao.
 *
 * Trước đây là năm nút số, và số thì không tự nói lên chiều: người học phải
 * đọc chú thích "1 = đoán · 5 = chắc chắn" mới biết đằng nào là hơn. Sao lấp
 * đầy dần nên thấy ngay chiều tăng mà không cần chữ.
 *
 * Hai nhãn "Tôi đoán" / "Tôi chắc chắn" ở hai đầu thang đã bỏ: giữa một trang
 * làm bài vốn đã nhiều chữ, chúng làm hàng này rối hơn là rõ hơn. Ý nghĩa từng
 * mức không mất — nó nằm trong `aria-label` và trong tooltip của từng sao, nên
 * trình đọc màn hình vẫn nghe đủ, và ai rê chuột vẫn đọc được.
 *
 * Vẫn là năm nút thật (không phải một ô input): mỗi mức đều tới được bằng
 * phím Tab và có nhãn đọc lên được cho trình đọc màn hình.
 */

const LABEL_KEYS: MessageKey[] = [
  "practice.quiz.stars.l1",
  "practice.quiz.stars.l2",
  "practice.quiz.stars.l3",
  "practice.quiz.stars.l4",
  "practice.quiz.stars.l5",
];

export default function ConfidenceStars({
  value,
  onChange,
  readOnly = false,
  size = 24,
}: {
  value: number | null;
  /** Bỏ trống cùng với readOnly khi chỉ để hiển thị lại mức đã chọn. */
  onChange?: (n: number) => void;
  readOnly?: boolean;
  size?: number;
}) {
  const t = useT();
  const [hover, setHover] = useState<number | null>(null);
  // Rê chuột tới đâu thì tô tới đó, buông ra thì quay về mức đã chọn.
  const shown = hover ?? value ?? 0;

  if (readOnly) {
    return (
      <span className="inline-flex items-center gap-1" aria-label={t("practice.quiz.stars.read", { n: value ?? 0 })}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            size={size}
            aria-hidden
            className={n <= shown ? "fill-accent-400 text-accent-400" : "text-[rgb(var(--border))]"}
          />
        ))}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <div
        role="radiogroup"
        aria-label={t("practice.quiz.stars.group")}
        className="flex items-center gap-0.5"
        onMouseLeave={() => setHover(null)}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= shown;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={t("practice.quiz.stars.aria", { n, label: t(LABEL_KEYS[n - 1]!) })}
              title={t("practice.quiz.stars.title", { n, label: t(LABEL_KEYS[n - 1]!) })}
              onClick={() => onChange?.(n)}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(null)}
              className="rounded-md p-1 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <Star
                size={size}
                aria-hidden
                className={
                  filled
                    ? "fill-accent-400 text-accent-400"
                    : "text-[rgb(var(--border))] hover:text-accent-300"
                }
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
