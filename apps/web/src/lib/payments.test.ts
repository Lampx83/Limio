import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

/** Webhook Stripe (AC4): lưu payment_intent lúc thanh toán xong, và chuyển charge.refunded xuống lõi. */

const { prisma, extendEnrollmentAccess, processChargeRefund, getIntegrationSecret } = vi.hoisted(() => ({
  prisma: {
    order: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    course: { findUniqueOrThrow: vi.fn() },
    courseAccessPlan: { findUniqueOrThrow: vi.fn() },
    $transaction: vi.fn(),
  },
  extendEnrollmentAccess: vi.fn(),
  processChargeRefund: vi.fn(),
  getIntegrationSecret: vi.fn(),
}));

vi.mock("@feedbackme/db", () => ({ prisma }));
vi.mock("@feedbackme/core-lms", () => ({ extendEnrollmentAccess, processChargeRefund, getIntegrationSecret }));

const completed = (pi: unknown): Stripe.Event =>
  ({ type: "checkout.session.completed", data: { object: { id: "cs_1", payment_intent: pi } } }) as unknown as Stripe.Event;
const refunded = (charge: Partial<Stripe.Charge>): Stripe.Event =>
  ({ type: "charge.refunded", data: { object: { id: "ch_1", amount: 199000, amount_refunded: 199000, refunded: true, payment_intent: "pi_1", ...charge } } }) as unknown as Stripe.Event;

describe("chargeRefundFacts", () => {
  it("hoàn hết: cờ refunded; số tiền cộng dồn lấy từ amount_refunded", async () => {
    const { chargeRefundFacts } = await import("./payments");
    expect(chargeRefundFacts({ amount: 199000, amount_refunded: 199000, refunded: true, payment_intent: "pi_1" } as Stripe.Charge)).toEqual({
      paymentIntentRef: "pi_1",
      refundedCents: 199000,
      fullyRefunded: true,
    });
  });

  it("hoàn một phần: không phải hoàn hết", async () => {
    const { chargeRefundFacts } = await import("./payments");
    expect(chargeRefundFacts({ amount: 199000, amount_refunded: 50000, refunded: false, payment_intent: "pi_1" } as Stripe.Charge)?.fullyRefunded).toBe(false);
  });

  it("kiểm chéo bằng số tiền khi cờ refunded thiếu; amount 0 không bao giờ tính là hoàn hết", async () => {
    const { chargeRefundFacts } = await import("./payments");
    expect(chargeRefundFacts({ amount: 100, amount_refunded: 100, refunded: false, payment_intent: "pi_1" } as Stripe.Charge)?.fullyRefunded).toBe(true);
    expect(chargeRefundFacts({ amount: 0, amount_refunded: 0, refunded: false, payment_intent: "pi_1" } as Stripe.Charge)?.fullyRefunded).toBe(false);
  });

  it("payment_intent là object đã mở rộng thì lấy id; thiếu thì null", async () => {
    const { chargeRefundFacts } = await import("./payments");
    expect(chargeRefundFacts({ amount: 1, amount_refunded: 1, refunded: true, payment_intent: { id: "pi_obj" } } as unknown as Stripe.Charge)?.paymentIntentRef).toBe("pi_obj");
    expect(chargeRefundFacts({ amount: 1, amount_refunded: 1, refunded: true, payment_intent: null } as Stripe.Charge)).toBeNull();
  });
});

describe("processStripeWebhook", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
    prisma.course.findUniqueOrThrow.mockResolvedValue({ id: "c-1", version: 1 });
  });

  it("checkout.session.completed ghi payment_intent (dạng id) cùng lúc đánh dấu paid", async () => {
    prisma.order.findFirst.mockResolvedValue({ id: "o-1", status: "pending", userId: "u-1", courseId: "c-1", accessPlanId: null });
    const { processStripeWebhook } = await import("./payments");
    await processStripeWebhook(completed("pi_abc"));
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "o-1" },
      data: expect.objectContaining({ status: "paid", paymentIntentRef: "pi_abc" }),
    });
    expect(extendEnrollmentAccess).toHaveBeenCalledWith("u-1", { id: "c-1", version: 1 }, { id: null, durationMonths: null }, prisma, { via: "order" });
  });

  it("thiếu payment_intent thì vẫn đánh dấu paid, không ghi cột đó", async () => {
    prisma.order.findFirst.mockResolvedValue({ id: "o-1", status: "pending", userId: "u-1", courseId: "c-1", accessPlanId: null });
    const { processStripeWebhook } = await import("./payments");
    await processStripeWebhook(completed(null));
    const data = prisma.order.update.mock.calls[0]![0].data;
    expect(data.status).toBe("paid");
    expect("paymentIntentRef" in data).toBe(false);
  });

  it("đơn đã paid thì bỏ qua (Stripe gửi lại)", async () => {
    prisma.order.findFirst.mockResolvedValue({ id: "o-1", status: "paid" });
    const { processStripeWebhook } = await import("./payments");
    await processStripeWebhook(completed("pi_abc"));
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(extendEnrollmentAccess).not.toHaveBeenCalled();
  });

  it("charge.refunded chuyển các con số xuống lõi", async () => {
    processChargeRefund.mockResolvedValue({ result: "refunded", orderId: "o-1", enrollmentRevoked: true });
    const { processStripeWebhook } = await import("./payments");
    await processStripeWebhook(refunded({}));
    expect(processChargeRefund).toHaveBeenCalledWith({ paymentIntentRef: "pi_1", refundedCents: 199000, fullyRefunded: true });
  });

  it("charge.refunded không khớp đơn: không ném lỗi (trả 200 cho Stripe), ghi cảnh báo để xử lý tay", async () => {
    processChargeRefund.mockResolvedValue({ result: "order_not_found" });
    const { processStripeWebhook } = await import("./payments");
    await expect(processStripeWebhook(refunded({}))).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("không khớp đơn nào"));
  });

  it("hoàn một phần: không ném lỗi, cảnh báo nói rõ quyền giữ nguyên", async () => {
    processChargeRefund.mockResolvedValue({ result: "partial", orderId: "o-1" });
    const { processStripeWebhook } = await import("./payments");
    await processStripeWebhook(refunded({ amount_refunded: 50000, refunded: false }));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("MỘT PHẦN"));
  });

  it("charge không có payment_intent: bỏ qua, không gọi lõi", async () => {
    const { processStripeWebhook } = await import("./payments");
    await processStripeWebhook(refunded({ payment_intent: null }));
    expect(processChargeRefund).not.toHaveBeenCalled();
  });

  it("lỗi từ lõi được ném ra để route trả 500 và Stripe gửi lại (không nuốt)", async () => {
    processChargeRefund.mockRejectedValue(new Error("db down"));
    const { processStripeWebhook } = await import("./payments");
    await expect(processStripeWebhook(refunded({}))).rejects.toThrow("db down");
  });
});
