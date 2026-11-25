import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildSepayPgCheckout,
  parseSepayPgIpn,
  sepayPgCanonical,
  signSepayPgFields,
  verifySepayPgIpnSecret,
  type SepayPgConfig,
} from "./sepayPg";

const cfg: SepayPgConfig = { merchantId: "SP-TEST-ABC", secretKey: "bi-mat-test-123", ipnSecret: "ipn-khoa-dai-1234567890", env: "sandbox" };

describe("chữ ký cổng thanh toán SePay", () => {
  it("chuỗi đem ký khớp ví dụ trong tài liệu: tên=giá trị nối bằng dấu phẩy, theo thứ tự đã cho", () => {
    const doc = [
      ["order_amount", "100000"],
      ["merchant", "MERCHANT_123"],
      ["currency", "VND"],
      ["operation", "PURCHASE"],
      ["order_description", "Thanh toán đơn hàng #12345"],
      ["order_invoice_number", "INV_20231201_001"],
      ["success_url", "https://yoursite.com/payment/success"],
      ["error_url", "https://yoursite.com/payment/error"],
      ["cancel_url", "https://yoursite.com/payment/cancel"],
    ] as const;
    expect(sepayPgCanonical(doc)).toBe(
      "order_amount=100000,merchant=MERCHANT_123,currency=VND,operation=PURCHASE,order_description=Thanh toán đơn hàng #12345,order_invoice_number=INV_20231201_001,success_url=https://yoursite.com/payment/success,error_url=https://yoursite.com/payment/error,cancel_url=https://yoursite.com/payment/cancel",
    );
  });

  it("chữ ký = HMAC-SHA256 base64 của chuỗi đó; đổi thứ tự trường hoặc khoá thì chữ ký đổi", () => {
    const fields = [["merchant", "M"], ["order_amount", "1000"], ["currency", "VND"]] as const;
    const expected = createHmac("sha256", "k").update("merchant=M,order_amount=1000,currency=VND", "utf8").digest("base64");
    expect(signSepayPgFields(fields, "k")).toBe(expected);
    expect(signSepayPgFields([fields[1], fields[0], fields[2]], "k")).not.toBe(expected);
    expect(signSepayPgFields(fields, "k2")).not.toBe(expected);
  });

  it("bỏ trường rỗng và trường không thuộc danh sách ký (vd signature)", () => {
    expect(sepayPgCanonical([["merchant", "M"], ["customer_id", ""], ["signature", "xyz"], ["order_amount", "5"]])).toBe("merchant=M,order_amount=5");
  });
});

describe("buildSepayPgCheckout", () => {
  const input = {
    invoiceNumber: "LMK7P3Q9XA2R",
    amount: 199000,
    description: "Thanh toan khoa hoc hsk-4-quyen-1",
    successUrl: "https://limio.vn/api/payments/sepaypg/return?order=o&status=success",
    errorUrl: "https://limio.vn/api/payments/sepaypg/return?order=o&status=error",
    cancelUrl: "https://limio.vn/api/payments/sepaypg/return?order=o&status=cancel",
  };

  it("form có đủ trường theo thứ tự cố định, chữ ký ở cuối và khớp chuỗi đã ký", () => {
    const { url, fields } = buildSepayPgCheckout(cfg, input);
    expect(url).toBe("https://pay-sandbox.sepay.vn/v1/checkout/init");
    expect(fields.map(([n]) => n)).toEqual([
      "merchant", "operation", "order_amount", "currency", "order_invoice_number", "order_description", "success_url", "error_url", "cancel_url", "signature",
    ]);
    const signed = fields.slice(0, -1);
    expect(Object.fromEntries(fields)).toMatchObject({ merchant: "SP-TEST-ABC", operation: "PURCHASE", order_amount: "199000", currency: "VND" });
    expect(fields[fields.length - 1]![1]).toBe(signSepayPgFields(signed, cfg.secretKey));
  });

  it("môi trường production dùng địa chỉ thật; số tiền lẻ bị cắt", () => {
    const r = buildSepayPgCheckout({ ...cfg, env: "production" }, { ...input, amount: 199000.9 });
    expect(r.url).toBe("https://pay.sepay.vn/v1/checkout/init");
    expect(Object.fromEntries(r.fields).order_amount).toBe("199000");
  });
});

describe("IPN", () => {
  const paid = {
    timestamp: 1757058220,
    notification_type: "ORDER_PAID",
    order: { id: "o-1", order_id: "NQ6", order_status: "CAPTURED", order_currency: "VND", order_amount: "199000.00", order_invoice_number: "LMK7P3Q9XA2R" },
    transaction: { id: "t-1", transaction_id: "TXN-999", transaction_status: "APPROVED", transaction_amount: "199000" },
  };
  it("ORDER_PAID + CAPTURED + APPROVED → paid, số tiền đổi sang đồng nguyên", () => {
    expect(parseSepayPgIpn(paid)).toEqual({ kind: "paid", invoiceNumber: "LMK7P3Q9XA2R", amount: 199000, transactionId: "TXN-999" });
  });
  it("không cấp quyền cho trạng thái khác, TRANSACTION_VOID, thân hỏng", () => {
    expect(parseSepayPgIpn({ ...paid, order: { ...paid.order, order_status: "AUTHENTICATION_NOT_NEEDED" } })).toEqual({ kind: "ignored", reason: "not_paid" });
    expect(parseSepayPgIpn({ ...paid, transaction: { ...paid.transaction, transaction_status: "DECLINED" } })).toEqual({ kind: "ignored", reason: "not_paid" });
    expect(parseSepayPgIpn({ ...paid, notification_type: "TRANSACTION_VOID" })).toEqual({ kind: "ignored", reason: "void" });
    expect(parseSepayPgIpn({ ...paid, notification_type: "SOMETHING" })).toEqual({ kind: "ignored", reason: "other" });
    expect(parseSepayPgIpn(null)).toEqual({ kind: "invalid" });
    expect(parseSepayPgIpn({ notification_type: "ORDER_PAID" })).toEqual({ kind: "invalid" });
    expect(parseSepayPgIpn({ ...paid, order: { ...paid.order, order_amount: "abc" } })).toEqual({ kind: "invalid" });
    expect(parseSepayPgIpn({ ...paid, order: { ...paid.order, order_invoice_number: "" } })).toEqual({ kind: "invalid" });
  });
  it("xác thực X-Secret-Key", () => {
    expect(verifySepayPgIpnSecret(cfg.ipnSecret, cfg.ipnSecret)).toBe(true);
    expect(verifySepayPgIpnSecret(` ${cfg.ipnSecret} `, cfg.ipnSecret)).toBe(true);
    expect(verifySepayPgIpnSecret("sai", cfg.ipnSecret)).toBe(false);
    expect(verifySepayPgIpnSecret(null, cfg.ipnSecret)).toBe(false);
    expect(verifySepayPgIpnSecret("x", "")).toBe(false);
  });
});
