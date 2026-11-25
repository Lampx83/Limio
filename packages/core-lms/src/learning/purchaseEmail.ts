import { prisma, type PrismaClient } from "@feedbackme/db";
import { sendTemplatedEmail } from "../email/templates";

/**
 * Email sau khi người mua có quyền học (docs/tieu-chi/email-xac-nhan-don-hang.md):
 *  - `sendOrderConfirmationEmail`: đơn thanh toán thành công (VNPay, SePay…) → "cảm ơn + biên nhận".
 *  - `sendCodeActivatedEmail`: đổi mã kích hoạt thành công → "đã kích hoạt" (không in lại mã, không có số tiền).
 *
 * Cả hai là best-effort: KHÔNG BAO GIỜ throw và không làm chậm hay hỏng việc cấp quyền (quyền đã cấp xong từ trước).
 * Chỉ gửi khi caller cung cấp `baseUrl` (để dựng liên kết vào học), cùng quy ước với email chào mừng của enroll.ts.
 */

const METHOD_LABEL: Record<string, string> = {
  vnpay: "VNPay",
  momo: "MoMo",
  sepay: "Chuyển khoản VietQR",
  sepay_pg: "SePay (QR, thẻ)",
  stripe: "Thẻ quốc tế",
};

/** Số tiền để hiện: VND lưu nguyên đồng, tiền tệ khác lưu theo cent. */
export function formatOrderAmount(amountCents: number, currency: string): string {
  if (currency === "VND") {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amountCents);
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amountCents / 100);
}

/** Câu mô tả quyền truy cập từ các hạn của (các) ghi danh: lấy hạn SỚM nhất; không hạn nào → không giới hạn thời gian. */
export function accessText(expiries: Array<Date | null>): string {
  const dated = expiries.filter((d): d is Date => d !== null);
  if (expiries.length > 0 && dated.length === 0) return "Không giới hạn thời gian";
  if (dated.length === 0) return "Đã mở";
  const earliest = new Date(Math.min(...dated.map((d) => d.getTime())));
  const day = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(earliest);
  return `Đến hết ngày ${day}`;
}

function dateTimeVn(d: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh",
  }).format(d);
}

function url(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export async function sendOrderConfirmationEmail(orderId: string, baseUrl: string, db: PrismaClient = prisma): Promise<void> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { email: true, displayName: true } },
        course: { select: { slug: true, title: true, organizationId: true } },
        bundle: { select: { slug: true, title: true, items: { select: { courseId: true, course: { select: { title: true } } } } } },
      },
    });
    if (!order || order.status !== "paid" || !order.user.email) return;

    const courseIds = order.bundle ? order.bundle.items.map((i) => i.courseId) : order.courseId ? [order.courseId] : [];
    const enrollments = courseIds.length
      ? await db.enrollment.findMany({ where: { userId: order.userId, courseId: { in: courseIds } }, select: { accessExpiresAt: true } })
      : [];

    const itemTitle = order.bundle
      ? `${order.bundle.title} (${order.bundle.items.length} khoá)`
      : (order.course?.title ?? "Khoá học");
    // Đơn combo mở nhiều khoá: đưa về trang học của mình; đơn một khoá: vào thẳng khoá.
    const actionUrl = order.course ? url(baseUrl, `/learn/${order.course.slug}`) : url(baseUrl, "/me");
    await sendTemplatedEmail({
      key: "order.confirmation",
      to: order.user.email,
      organizationId: order.course?.organizationId ?? null,
      variables: {
        learnerName: order.user.displayName,
        orderCode: order.providerRef ?? order.id.slice(0, 8).toUpperCase(),
        itemTitle,
        amountText: formatOrderAmount(order.amountCents, order.currency),
        methodLabel: METHOD_LABEL[order.provider] ?? String(order.provider),
        paidAtText: dateTimeVn(order.paidAt ?? new Date()),
        accessText: accessText(enrollments.map((e) => e.accessExpiresAt)),
        actionUrl,
        actionLabel: order.course ? "Vào học" : "Vào học tại Khoá học của tôi",
      },
    });
  } catch (e) {
    console.error(`[purchase-email] order_confirmation_failed order=${orderId} error=${e instanceof Error ? e.message : "unknown"}`);
  }
}

export async function sendCodeActivatedEmail(
  userId: string,
  input: { itemTitle: string; /** null = nhiều khoá (combo) → về trang học của tôi. */ courseSlug: string | null; accessExpiresAt: Date | null },
  baseUrl: string,
  db: PrismaClient = prisma,
): Promise<void> {
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, displayName: true } });
    if (!user?.email) return;
    await sendTemplatedEmail({
      key: "course.activated",
      to: user.email,
      variables: {
        learnerName: user.displayName,
        itemTitle: input.itemTitle,
        accessText: accessText([input.accessExpiresAt]),
        actionUrl: input.courseSlug ? url(baseUrl, `/learn/${input.courseSlug}`) : url(baseUrl, "/me"),
        actionLabel: input.courseSlug ? "Vào học" : "Vào học tại Khoá học của tôi",
      },
    });
  } catch (e) {
    console.error(`[purchase-email] code_activated_failed user=${userId} error=${e instanceof Error ? e.message : "unknown"}`);
  }
}
