import type { LibraryCard, LibraryQuery } from "@feedbackme/core-lms";
import { formatPrice, isFree } from "@/lib/formatPrice";

/**
 * LANG đợt 2 — phần thuần của trang Thư viện giáo trình (link giữ nguyên bộ lọc, nhãn giá). Tách khỏi React để thử
 * được không cần dựng giao diện.
 */

export type LibraryHrefOverrides = Partial<Record<keyof LibraryQuery, string | number | null>>;

/**
 * Đường dẫn `/language/thu-vien?...` từ truy vấn hiện tại cộng các thay đổi. Giá trị mặc định (tab all, sort
 * relevant, trang 1, rỗng) không đưa vào URL để link ngắn và có một dạng chuẩn. Đổi bộ lọc thì về trang 1.
 */
export function libraryHref(query: LibraryQuery, overrides: LibraryHrefOverrides = {}): string {
  const merged: Record<string, string | number | null> = { ...query, ...overrides };
  if (!("page" in overrides) && Object.keys(overrides).length > 0) merged.page = 1;
  const qs = new URLSearchParams();
  for (const k of ["q", "publisher", "level", "focus", "tab", "sort", "page"] as const) {
    const v = merged[k];
    if (v === null || v === undefined || v === "") continue;
    if (k === "tab" && v === "all") continue;
    if (k === "sort" && v === "relevant") continue;
    if (k === "page" && Number(v) <= 1) continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `/language/thu-vien?${s}` : "/language/thu-vien";
}

/** Có đang tìm kiếm hoặc lọc không (không tính tab, sắp xếp, trang). */
export function hasLibraryFilter(q: LibraryQuery): boolean {
  return !!(q.q || q.publisher || q.level || q.focus);
}

/**
 * Dòng giá trên thẻ — cùng quy tắc với thẻ ở `/catalog`: có gói truy cập (và cổng thanh toán bật) thì "Từ X";
 * khoá có giá phẳng thì giá đó; còn lại "Miễn phí".
 */
export function libraryPriceLabel(card: Pick<LibraryCard, "priceCents" | "currency" | "cheapestPlan">, paymentEnabled: boolean): string {
  if (paymentEnabled && card.cheapestPlan) return `Từ ${formatPrice(card.cheapestPlan.priceCents, card.cheapestPlan.currency)}`;
  if (paymentEnabled && !isFree(card.priceCents)) return formatPrice(card.priceCents!, card.currency);
  return "Miễn phí";
}

/** Dòng "nhà xuất bản · tác giả · ấn bản" bỏ phần trống. */
export function libraryByline(card: Pick<LibraryCard, "publisher" | "authors" | "edition">): string {
  return [card.publisher, card.authors, card.edition].filter(Boolean).join(" · ");
}
