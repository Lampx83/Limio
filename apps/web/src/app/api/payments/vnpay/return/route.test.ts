import { beforeEach, describe, expect, it, vi } from "vitest";

/** Trang quay về VNPay (AC4): chỉ chuyển hướng, không đổi đơn. */

const { prisma, getVnpayConfig } = vi.hoisted(() => ({
  prisma: { order: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() } },
  getVnpayConfig: vi.fn(),
}));

vi.mock("@feedbackme/db", () => ({ prisma }));
vi.mock("@feedbackme/core-lms", () => ({ getIntegrationSecret: vi.fn() }));
vi.mock("@/lib/vnpay", async (importActual) => ({ ...(await importActual<typeof import("@/lib/vnpay")>()), getVnpayConfig }));

import { signVnpayParams } from "@/lib/vnpay";

const CFG = { tmnCode: "ABCD1234", hashSecret: "SECRETKEY0123456789", paymentUrl: "https://sandbox.example/vpcpay.html" };

function back(over: Record<string, string> = {}, sign = true) {
  const params: Record<string, string> = { vnp_TmnCode: "ABCD1234", vnp_Amount: "19900000", vnp_ResponseCode: "00", vnp_TxnRef: "abc123", ...over };
  const qs = new URLSearchParams({ ...params, ...(sign ? { vnp_SecureHash: signVnpayParams(params, CFG.hashSecret) } : {}) });
  return import("./route").then(({ GET }) => GET(new Request(`https://limio.vn/api/payments/vnpay/return?${qs}`)));
}
const where = (r: Response) => new URL(r.headers.get("location")!).pathname + new URL(r.headers.get("location")!).search;

describe("GET /api/payments/vnpay/return", () => {
  beforeEach(() => {
    prisma.order.findFirst.mockReset().mockResolvedValue({ course: { slug: "sach-dien-tu" } });
    prisma.order.update.mockReset();
    prisma.order.updateMany.mockReset();
    getVnpayConfig.mockReset().mockResolvedValue(CFG);
  });

  it("thành công → vào khoá, cùng điểm đến với Stripe", async () => {
    expect(where(await back())).toBe("/learn/sach-dien-tu?paid=1");
  });

  it("không thành công (huỷ, hết hạn…) → về trang khoá học kèm cancelled", async () => {
    expect(where(await back({ vnp_ResponseCode: "24" }))).toBe("/catalog/sach-dien-tu?cancelled=1");
  });

  it("chữ ký sai hoặc thiếu, chưa cấu hình, hoặc không có đơn → trang chủ, không lộ gì", async () => {
    expect(where(await back({}, false))).toBe("/");
    getVnpayConfig.mockResolvedValue(null);
    expect(where(await back())).toBe("/");
    getVnpayConfig.mockResolvedValue(CFG);
    prisma.order.findFirst.mockResolvedValue(null);
    expect(where(await back())).toBe("/");
  });

  it("KHÔNG BAO GIỜ đổi đơn hay cấp quyền, kể cả khi thành công", async () => {
    await back();
    await back({ vnp_ResponseCode: "24" });
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("chỉ tra đơn của VNPay theo mã giao dịch", async () => {
    await back();
    expect(prisma.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { provider: "vnpay", providerRef: "abc123" } }));
  });
});
