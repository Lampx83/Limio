/**
 * Format a course price for display.
 * VND has no sub-unit so priceCents stores whole đồng directly.
 * All other currencies store cents (÷100).
 */
export function formatPrice(priceCents: number, currency: string): string {
  if (currency === "VND") {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(priceCents);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(priceCents / 100);
}

/**
 * % giảm giá (làm tròn, tối thiểu 1, tối đa 99) khi giá gốc LỚN HƠN giá bán; null khi không có khuyến mãi hợp lệ
 * (thiếu giá gốc, giá bán miễn phí, hoặc giá gốc ≤ giá bán). Không lưu trong DB: luôn tính từ hai giá.
 */
export function discountPercent(
  originalCents: number | null | undefined,
  saleCents: number | null | undefined,
): number | null {
  if (!originalCents || !saleCents || saleCents <= 0 || originalCents <= saleCents) return null;
  const pct = Math.round((1 - saleCents / originalCents) * 100);
  return Math.min(99, Math.max(1, pct));
}

export function isFree(priceCents: number | null | undefined): boolean {
  return priceCents === null || priceCents === undefined || priceCents === 0;
}
