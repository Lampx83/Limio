import { beforeEach, describe, expect, it, vi } from "vitest";

/** Tạo thanh toán VNPay (AC2): điều kiện, đơn pending, URL đã ký đúng. */

const { prisma, getVnpayConfig } = vi.hoisted(() => ({
  prisma: {
    course: { findUniqueOrThrow: vi.fn() },
    courseAccessPlan: { findUnique: vi.fn() },
    order: { create: vi.fn() },
  },
  getVnpayConfig: vi.fn(),
}));

vi.mock("@feedbackme/db", () => ({ prisma }));
vi.mock("@feedbackme/core-lms", () => ({ getIntegrationSecret: vi.fn() }));
vi.mock("@/lib/vnpay", async (importActual) => ({ ...(await importActual<typeof import("@/lib/vnpay")>()), getVnpayConfig }));

import { verifyVnpayParams } from "@/lib/vnpay";
import { VnpayPaymentError, createVnpayPayment } from "./vnpayPayment";

const CFG = { tmnCode: "ABCD1234", hashSecret: "SECRETKEY0123456789", paymentUrl: "https://sandbox.example/vpcpay.html" };
const INPUT = { userId: "u-1", courseId: "c-1", ipAddr: "203.0.113.7", returnUrl: "https://limio.vn/api/payments/vnpay/return" };

async function codeOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    if (e instanceof VnpayPaymentError) return e.code;
    throw e;
  }
}

describe("createVnpayPayment", () => {
  beforeEach(() => {
    getVnpayConfig.mockReset().mockResolvedValue(CFG);
    prisma.course.findUniqueOrThrow.mockReset().mockResolvedValue({ id: "c-1", slug: "sach-dien-tu", status: "published", priceCents: 199_000, currency: "VND" });
    prisma.courseAccessPlan.findUnique.mockReset();
    prisma.order.create.mockReset().mockResolvedValue({});
  });

  it("giá phẳng: tạo đơn pending và URL đã ký đúng, mã giao dịch = providerRef, tiền × 100, hết hạn sau 15 phút", async () => {
    const { orderId, url } = await createVnpayPayment(INPUT);

    const data = prisma.order.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ id: orderId, userId: "u-1", courseId: "c-1", accessPlanId: null, amountCents: 199_000, currency: "VND", provider: "vnpay", status: "pending" });
    expect(data.providerRef).toBe(orderId.replace(/-/g, ""));
    expect(data.providerRef).toMatch(/^[0-9a-f]{32}$/);

    const u = new URL(url);
    expect(u.origin + u.pathname).toBe(CFG.paymentUrl);
    expect(verifyVnpayParams(u.searchParams, CFG.hashSecret)).toBe(true);
    const q = u.searchParams;
    expect(q.get("vnp_Amount")).toBe("19900000");
    expect(q.get("vnp_TxnRef")).toBe(data.providerRef);
    expect(q.get("vnp_TmnCode")).toBe("ABCD1234");
    expect(q.get("vnp_CurrCode")).toBe("VND");
    expect(q.get("vnp_Version")).toBe("2.1.0");
    expect(q.get("vnp_Command")).toBe("pay");
    expect(q.get("vnp_IpAddr")).toBe("203.0.113.7");
    expect(q.get("vnp_ReturnUrl")).toBe(INPUT.returnUrl);
    expect(q.get("vnp_OrderInfo")).toBe("Thanh toan khoa hoc sach dien tu");
    expect(q.get("vnp_CreateDate")).toMatch(/^\d{14}$/);
    // hết hạn đúng 15 phút sau lúc tạo (cùng múi giờ nên so số học trên chuỗi thời gian)
    const toMin = (s: string) => Number(s.slice(8, 10)) * 60 + Number(s.slice(10, 12));
    expect((toMin(q.get("vnp_ExpireDate")!) - toMin(q.get("vnp_CreateDate")!) + 1440) % 1440).toBe(15);
  });

  it("gói truy cập: lấy giá và gắn accessPlanId của gói", async () => {
    prisma.courseAccessPlan.findUnique.mockResolvedValue({ id: "p-1", courseId: "c-1", isActive: true, priceCents: 99_000, currency: "VND" });
    const { url } = await createVnpayPayment({ ...INPUT, accessPlanId: "p-1" });
    expect(prisma.order.create.mock.calls[0]![0].data).toMatchObject({ accessPlanId: "p-1", amountCents: 99_000 });
    expect(new URL(url).searchParams.get("vnp_Amount")).toBe("9900000");
  });

  it("mỗi lần gọi là một đơn mới với mã giao dịch mới", async () => {
    const a = await createVnpayPayment(INPUT);
    const b = await createVnpayPayment(INPUT);
    expect(a.orderId).not.toBe(b.orderId);
    expect(prisma.order.create).toHaveBeenCalledTimes(2);
  });

  it("từ chối và KHÔNG tạo đơn: chưa cấu hình, khoá chưa xuất bản, khoá miễn phí, gói không hợp lệ, không phải VND", async () => {
    getVnpayConfig.mockResolvedValue(null);
    expect(await codeOf(createVnpayPayment(INPUT))).toBe("vnpay_not_configured");
    getVnpayConfig.mockResolvedValue(CFG);

    prisma.course.findUniqueOrThrow.mockResolvedValue({ id: "c-1", slug: "s", status: "draft", priceCents: 199_000, currency: "VND" });
    expect(await codeOf(createVnpayPayment(INPUT))).toBe("course_not_enrollable");

    prisma.course.findUniqueOrThrow.mockResolvedValue({ id: "c-1", slug: "s", status: "published", priceCents: null, currency: "VND" });
    expect(await codeOf(createVnpayPayment(INPUT))).toBe("course_is_free");
    prisma.course.findUniqueOrThrow.mockResolvedValue({ id: "c-1", slug: "s", status: "published", priceCents: 0, currency: "VND" });
    expect(await codeOf(createVnpayPayment(INPUT))).toBe("course_is_free");

    prisma.course.findUniqueOrThrow.mockResolvedValue({ id: "c-1", slug: "s", status: "published", priceCents: 199_000, currency: "VND" });
    for (const plan of [null, { id: "p", courseId: "khac", isActive: true, priceCents: 1, currency: "VND" }, { id: "p", courseId: "c-1", isActive: false, priceCents: 1, currency: "VND" }]) {
      prisma.courseAccessPlan.findUnique.mockResolvedValue(plan);
      expect(await codeOf(createVnpayPayment({ ...INPUT, accessPlanId: "p" }))).toBe("access_plan_not_found");
    }

    prisma.course.findUniqueOrThrow.mockResolvedValue({ id: "c-1", slug: "s", status: "published", priceCents: 20, currency: "USD" });
    expect(await codeOf(createVnpayPayment(INPUT))).toBe("currency_not_supported");
    prisma.course.findUniqueOrThrow.mockResolvedValue({ id: "c-1", slug: "s", status: "published", priceCents: 199_000.5, currency: "VND" });
    expect(await codeOf(createVnpayPayment(INPUT))).toBe("currency_not_supported");

    expect(prisma.order.create).not.toHaveBeenCalled();
  });
});
