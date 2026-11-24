import { discountPercent, formatPrice } from "@/lib/formatPrice";

/**
 * Giá gốc gạch ngang + nhãn "-67%" cạnh giá bán (khuyến mãi). Không vẽ gì khi không có khuyến mãi hợp lệ
 * (giá gốc thiếu hoặc không lớn hơn giá bán), nên dùng được ở mọi nơi hiện giá mà không cần kiểm trước.
 */
export function PriceStrike({
  originalCents,
  saleCents,
  currency,
  className = "",
}: {
  originalCents: number | null | undefined;
  saleCents: number | null | undefined;
  currency: string;
  className?: string;
}) {
  if (discountPercent(originalCents, saleCents) === null) return null;
  return (
    <span className={`font-normal line-through opacity-70 tabular-nums ${className}`} data-testid="price-original">
      {formatPrice(originalCents!, currency)}
    </span>
  );
}

export function DiscountBadge({
  originalCents,
  saleCents,
  className = "",
}: {
  originalCents: number | null | undefined;
  saleCents: number | null | undefined;
  className?: string;
}) {
  const pct = discountPercent(originalCents, saleCents);
  if (pct === null) return null;
  return (
    <span
      className={`inline-block rounded bg-red-50 px-1.5 py-0.5 text-xs font-bold text-red-600 ${className}`}
      data-testid="price-discount"
    >
      -{pct}%
    </span>
  );
}

/**
 * Khối giá xếp dọc kiểu trang đặt phòng: "-67%" đỏ, giá gốc gạch ngang xám đậm, giá bán to màu đỏ, rồi dòng ghi chú nhỏ
 * (vd "Truy cập 1 năm"). Không có khuyến mãi hợp lệ thì chỉ còn giá bán (màu thường) và ghi chú.
 * `size="sm"` dùng trong danh sách gói (mỗi gói một dòng), mặc định dùng ở ô giá lớn.
 */
export function PriceBlock({
  originalCents,
  saleCents,
  currency,
  note,
  align = "right",
  size = "lg",
}: {
  originalCents?: number | null;
  saleCents: number;
  currency: string;
  note?: string;
  align?: "left" | "right";
  size?: "sm" | "lg";
}) {
  const pct = discountPercent(originalCents, saleCents);
  const sm = size === "sm";
  return (
    <div className={`leading-tight ${align === "right" ? "text-right" : "text-left"}`} data-testid="price-block">
      {pct !== null && (
        <div className={`font-bold text-red-600 ${sm ? "text-sm" : "text-lg"}`} data-testid="price-discount">
          -{pct}%
        </div>
      )}
      {pct !== null && (
        <div className={`font-bold tabular-nums text-gray-500 line-through ${sm ? "text-sm" : "text-xl"}`} data-testid="price-original">
          {formatPrice(originalCents!, currency)}
        </div>
      )}
      <div className={`font-extrabold tabular-nums ${pct !== null ? "text-red-600" : ""} ${sm ? "text-lg" : "text-3xl"}`} data-testid="price-sale">
        {formatPrice(saleCents, currency)}
      </div>
      {note && <div className="mt-1 text-xs text-faint">{note}</div>}
    </div>
  );
}
