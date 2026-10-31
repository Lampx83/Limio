import { beforeEach, describe, expect, it, vi } from "vitest";

/** IPN VNPay (AC3): chữ ký, mã website, số tiền, và ánh xạ kết quả của lõi sang RspCode. */

const { settleGatewayPayment, getVnpayConfig } = vi.hoisted(() => ({
  settleGatewayPayment: vi.fn(),
  getVnpayConfig: vi.fn(),
}));

vi.mock("@feedbackme/core-lms", () => ({ settleGatewayPayment, getIntegrationSecret: vi.fn() }));
vi.mock("@/lib/vnpay", async (importActual) => ({ ...(await importActual<typeof import("@/lib/vnpay")>()), getVnpayConfig }));

import { signVnpayParams } from "@/lib/vnpay";

const CFG = { tmnCode: "ABCD1234", hashSecret: "SECRETKEY0123456789", paymentUrl: "https://sandbox.example/vpcpay.html" };
const BASE: Record<string, string> = {
  vnp_TmnCode: "ABCD1234",
  vnp_Amount: "19900000",
  vnp_BankCode: "NCB",
  vnp_BankTranNo: "VNP14012345",
  vnp_CardType: "ATM",
  vnp_OrderInfo: "Thanh toan khoa hoc",
  vnp_PayDate: "20261031201500",
  vnp_ResponseCode: "00",
  vnp_TransactionNo: "14012345",
  vnp_TransactionStatus: "00",
  vnp_TxnRef: "0123456789abcdef0123456789abcdef",
};

function ipn(over: Record<string, string> = {}, opts: { sign?: boolean; secret?: string } = {}) {
  const params = { ...BASE, ...over };
  const hash = opts.sign === false ? "" : signVnpayParams(params, opts.secret ?? CFG.hashSecret);
  const qs = new URLSearchParams({ ...params, ...(hash ? { vnp_SecureHash: hash } : {}) });
  return import("./route").then(({ GET }) => GET(new Request(`https://limio.vn/api/webhooks/vnpay?${qs}`)));
}
const body = async (r: Response) => (await r.json()) as { RspCode: string; Message: string };

describe("GET /api/webhooks/vnpay", () => {
  beforeEach(() => {
    settleGatewayPayment.mockReset().mockResolvedValue({ result: "paid", orderId: "o-1" });
    getVnpayConfig.mockReset().mockResolvedValue(CFG);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("chưa cấu hình VNPay → 99, không đụng lõi", async () => {
    getVnpayConfig.mockResolvedValue(null);
    expect((await body(await ipn())).RspCode).toBe("99");
    expect(settleGatewayPayment).not.toHaveBeenCalled();
  });

  it("chữ ký sai, thiếu, hoặc ký bằng khoá khác → 97, không đụng lõi", async () => {
    expect((await body(await ipn({}, { sign: false }))).RspCode).toBe("97");
    expect((await body(await ipn({}, { secret: "khac" }))).RspCode).toBe("97");
    // đổi số tiền sau khi ký
    const params = { ...BASE };
    const qs = new URLSearchParams({ ...params, vnp_SecureHash: signVnpayParams(params, CFG.hashSecret) });
    qs.set("vnp_Amount", "100");
    const { GET } = await import("./route");
    expect((await body(await GET(new Request(`https://limio.vn/api/webhooks/vnpay?${qs}`)))).RspCode).toBe("97");
    expect(settleGatewayPayment).not.toHaveBeenCalled();
  });

  it("chữ ký đúng nhưng mã website không phải của mình → 99", async () => {
    expect((await body(await ipn({ vnp_TmnCode: "KHAC0000" }))).RspCode).toBe("99");
    expect(settleGatewayPayment).not.toHaveBeenCalled();
  });

  it("số tiền hỏng (không nguyên, không chia hết 100, ≤ 0, không phải số) → 04", async () => {
    for (const vnp_Amount of ["abc", "0", "-100", "19900050", "199.5"]) {
      expect((await body(await ipn({ vnp_Amount }))).RspCode).toBe("04");
    }
    expect(settleGatewayPayment).not.toHaveBeenCalled();
  });

  it("thành công: lõi nhận số đồng (chia 100), mã giao dịch của cổng, success=true", async () => {
    const r = await ipn();
    expect(r.status).toBe(200);
    expect(await body(r)).toEqual({ RspCode: "00", Message: "Confirm Success" });
    expect(settleGatewayPayment).toHaveBeenCalledWith({
      provider: "vnpay",
      txnRef: BASE.vnp_TxnRef,
      paidAmountCents: 199_000,
      success: true,
      gatewayTxnRef: "14012345",
    });
  });

  it("chỉ thành công khi CẢ vnp_ResponseCode và vnp_TransactionStatus đều 00", async () => {
    const failures: Array<Record<string, string>> = [{ vnp_ResponseCode: "24" }, { vnp_TransactionStatus: "02" }, { vnp_ResponseCode: "07" }];
    for (const over of failures) {
      settleGatewayPayment.mockClear().mockResolvedValue({ result: "failed", orderId: "o-1" });
      expect((await body(await ipn(over))).RspCode).toBe("00"); // đã nhận kết quả; VNPay không cần gửi lại
      expect(settleGatewayPayment.mock.calls[0]![0].success).toBe(false);
    }
  });

  it("ánh xạ kết quả của lõi sang RspCode", async () => {
    const cases: Array<[unknown, string]> = [
      [{ result: "order_not_found" }, "01"],
      [{ result: "amount_mismatch", orderId: "o" }, "04"],
      [{ result: "already_confirmed", orderId: "o" }, "02"],
      [{ result: "paid", orderId: "o" }, "00"],
      [{ result: "failed", orderId: "o" }, "00"],
    ];
    for (const [outcome, code] of cases) {
      settleGatewayPayment.mockResolvedValue(outcome);
      expect((await body(await ipn())).RspCode).toBe(code);
    }
  });

  it("lõi lỗi → 99 (VNPay sẽ gửi lại), không ném ra ngoài", async () => {
    settleGatewayPayment.mockRejectedValue(new Error("db down"));
    const r = await ipn();
    expect(r.status).toBe(200);
    expect((await body(r)).RspCode).toBe("99");
  });

  it("không ghi khoá bí mật hay chữ ký ra log khi lệch số tiền", async () => {
    settleGatewayPayment.mockResolvedValue({ result: "amount_mismatch", orderId: "o-9" });
    await ipn();
    const logged = JSON.stringify((console.warn as unknown as { mock: { calls: unknown[] } }).mock.calls);
    expect(logged).toContain("o-9");
    expect(logged).not.toContain(CFG.hashSecret);
    expect(logged).not.toContain("vnp_SecureHash");
  });
});
