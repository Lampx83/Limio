/**
 * Quyết định hiển thị của trang thanh toán (docs/tieu-chi/trang-thanh-toan.md, AC1–AC2). Hàm thuần để test được: trang chỉ
 * việc đọc dữ liệu rồi làm theo kết quả.
 */
export type CheckoutGate = { kind: "ok" } | { kind: "redirect"; to: string } | { kind: "notFound" };

export function courseCheckoutGate(input: {
  slug: string;
  userId: string | null;
  course: { status: string; enrollMode: string; priceCents: number | null } | null;
  paymentEnabled: boolean;
  /** Số gói truy cập đang bán. */
  planCount: number;
  enrolled: boolean;
  /** Quyền học hiện tại có hạn (không phải vô thời hạn): cho vào trang thanh toán để GIA HẠN (thời hạn mới cộng dồn). */
  accessLimited?: boolean;
}): CheckoutGate {
  const { slug, userId, course, paymentEnabled, planCount, enrolled, accessLimited = false } = input;
  if (!course) return { kind: "notFound" };
  const hasPrice = planCount > 0 || (course.priceCents ?? 0) > 0;
  // Không có gì để mua ở đây (nháp, chỉ mời, miễn phí, thanh toán tắt): về trang khoá, nơi nói đúng tình trạng.
  if (course.status !== "published" || course.enrollMode === "invite_only" || !paymentEnabled || !hasPrice) {
    return { kind: "redirect", to: `/catalog/${slug}` };
  }
  if (!userId) return { kind: "redirect", to: `/signin?callbackUrl=${encodeURIComponent(`/checkout/${slug}`)}` };
  // Đã có quyền vô thời hạn: không bán lại. Quyền có hạn thì cho gia hạn.
  if (enrolled && !accessLimited) return { kind: "redirect", to: `/learn/${slug}` };
  return { kind: "ok" };
}

export function bundleCheckoutGate(input: {
  slug: string;
  userId: string | null;
  bundle: { purchasable: boolean; currency: string } | null;
  paymentEnabled: boolean;
}): CheckoutGate {
  const { slug, userId, bundle, paymentEnabled } = input;
  if (!bundle) return { kind: "notFound" };
  if (!bundle.purchasable || bundle.currency !== "VND" || !paymentEnabled) return { kind: "redirect", to: `/combo/${slug}` };
  if (!userId) return { kind: "redirect", to: `/signin?callbackUrl=${encodeURIComponent(`/checkout/combo/${slug}`)}` };
  return { kind: "ok" };
}
