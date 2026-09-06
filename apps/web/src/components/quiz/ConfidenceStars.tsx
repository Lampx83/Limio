"use client";

import { useState } from "react";
import { Star } from "lucide-react";

/**
 * Thang độ tự tin 1–5 dưới dạng sao.
 *
 * Trước đây là năm nút số, và số thì không tự nói lên chiều: người học phải
 * đọc chú thích "1 = đoán · 5 = chắc chắn" mới biết đằng nào là hơn. Sao lấp
 * đầy dần nên thấy ngay chiều tăng, và hai đầu thang được gọi tên ngay tại
 * chỗ — không phải đọc chú thích rời rồi tự nội suy ngược lại.
 *
 * Vẫn là năm nút thật (không phải một ô input): mỗi mức đều tới được bằng
 * phím Tab và có nhãn đọc lên được cho trình đọc màn hình.
 */

const LABELS = ["Đoán thôi", "Không chắc lắm", "Tạm tin", "Khá chắc", "Chắc chắn"];

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
  const [hover, setHover] = useState<number | null>(null);
  // Rê chuột tới đâu thì tô tới đó, buông ra thì quay về mức đã chọn.
  const shown = hover ?? value ?? 0;

  if (readOnly) {
    return (
      <span className="inline-flex items-center gap-1" aria-label={`Độ tự tin ${value ?? 0}/5`}>
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
      {/* Tên hai đầu thang đứng ngay cạnh sao: người học đọc được chiều mà
          không phải tra chú thích rời. */}
      <span className="text-sm text-muted">Tôi đoán</span>
      <div
        role="radiogroup"
        aria-label="Độ tự tin"
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
              aria-label={`${n} trên 5 — ${LABELS[n - 1]}`}
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
      <span className="text-sm text-muted">Tôi chắc chắn</span>
    </div>
  );
}
