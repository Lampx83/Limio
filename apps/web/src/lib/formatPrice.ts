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

export function isFree(priceCents: number | null | undefined): boolean {
  return priceCents === null || priceCents === undefined || priceCents === 0;
}
