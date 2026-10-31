import { beforeEach, describe, expect, it, vi } from "vitest";

const { getIntegrationSecret } = vi.hoisted(() => ({ getIntegrationSecret: vi.fn() }));
vi.mock("@feedbackme/core-lms", () => ({ getIntegrationSecret }));

import {
  VNPAY_SANDBOX_URL,
  buildVnpayPaymentUrl,
  formatVnpayDate,
  getVnpayConfig,
  signVnpayParams,
  verifyVnpayParams,
  vnpayCanonical,
  vnpayOrderInfo,
} from "./vnpay";

const SECRET = "SECRETKEY0123456789";
const PARAMS: Record<string, string> = {
  vnp_Version: "2.1.0",
  vnp_Command: "pay",
  vnp_TmnCode: "ABCD1234",
  vnp_Amount: "19900000",
  vnp_CurrCode: "VND",
  vnp_TxnRef: "0123456789abcdef0123456789abcdef",
  vnp_OrderInfo: "Thanh toan khoa hoc sach dien tu",
  vnp_OrderType: "other",
  vnp_Locale: "vn",
  vnp_ReturnUrl: "https://limio.vn/api/payments/vnpay/return?x=1&y=a b",
  vnp_IpAddr: "203.0.113.7",
  vnp_CreateDate: "20261031201500",
  vnp_ExpireDate: "20261031203000",
};
// Tính độc lập bằng Python (hmac + urllib.parse.quote_plus), không dùng chung mã với vnpay.ts.
const CANONICAL =
  "vnp_Amount=19900000&vnp_Command=pay&vnp_CreateDate=20261031201500&vnp_CurrCode=VND&vnp_ExpireDate=20261031203000&vnp_IpAddr=203.0.113.7&vnp_Locale=vn&vnp_OrderInfo=Thanh+toan+khoa+hoc+sach+dien+tu&vnp_OrderType=other&vnp_ReturnUrl=https%3A%2F%2Flimio.vn%2Fapi%2Fpayments%2Fvnpay%2Freturn%3Fx%3D1%26y%3Da+b&vnp_TmnCode=ABCD1234&vnp_TxnRef=0123456789abcdef0123456789abcdef&vnp_Version=2.1.0";
const HASH =
  "fd020ed249abcc1a5a6a3f77b3793b100158ecea0f79be0b060f5656ee3cbbb69c39761b6b8a8fa69e753b4c351472e5ef88ead0fd7538c6c7755ad31c6dafc3";

describe("chữ ký VNPay", () => {
  it("chuỗi chuẩn và chữ ký khớp bản tính độc lập", () => {
    expect(vnpayCanonical(PARAMS)).toBe(CANONICAL);
    expect(signVnpayParams(PARAMS, SECRET)).toBe(HASH);
  });

  it("không phụ thuộc thứ tự tham số; bỏ qua trường chữ ký và tham số không phải vnp_", () => {
    const shuffled = Object.fromEntries(Object.entries(PARAMS).reverse());
    expect(signVnpayParams(shuffled, SECRET)).toBe(HASH);
    expect(signVnpayParams({ ...PARAMS, vnp_SecureHash: "x", vnp_SecureHashType: "HmacSHA512", other: "1" }, SECRET)).toBe(HASH);
  });

  it("khác khoá bí mật → chữ ký khác", () => {
    expect(signVnpayParams(PARAMS, SECRET + "x")).not.toBe(HASH);
  });
});

describe("verifyVnpayParams", () => {
  const signed: Record<string, string> = { ...PARAMS, vnp_SecureHash: HASH };

  it("hợp lệ khi đúng chữ ký, kể cả hex viết hoa", () => {
    expect(verifyVnpayParams(signed, SECRET)).toBe(true);
    expect(verifyVnpayParams({ ...signed, vnp_SecureHash: HASH.toUpperCase() }, SECRET)).toBe(true);
  });

  it("đi vòng qua URL thật: dựng URL, đọc lại bằng URLSearchParams (giải mã '+' và %xx), vẫn hợp lệ", () => {
    const url = new URL(buildVnpayPaymentUrl(VNPAY_SANDBOX_URL, PARAMS, SECRET));
    expect(url.origin + url.pathname).toBe(VNPAY_SANDBOX_URL);
    expect(url.searchParams.get("vnp_OrderInfo")).toBe("Thanh toan khoa hoc sach dien tu");
    expect(url.searchParams.get("vnp_ReturnUrl")).toBe(PARAMS.vnp_ReturnUrl);
    expect(verifyVnpayParams(url.searchParams, SECRET)).toBe(true);
  });

  it("sửa bất kỳ tham số nào, thêm hoặc bớt một tham số vnp_ → không hợp lệ", () => {
    for (const k of Object.keys(PARAMS)) {
      expect(verifyVnpayParams({ ...signed, [k]: PARAMS[k] + "0" }, SECRET)).toBe(false);
    }
    expect(verifyVnpayParams({ ...signed, vnp_Extra: "1" }, SECRET)).toBe(false);
    const { vnp_Amount: _drop, ...without } = signed;
    expect(verifyVnpayParams(without, SECRET)).toBe(false);
  });

  it("thiếu / rỗng / sai độ dài chữ ký, hoặc sai khoá → không hợp lệ", () => {
    expect(verifyVnpayParams(PARAMS, SECRET)).toBe(false);
    expect(verifyVnpayParams({ ...PARAMS, vnp_SecureHash: "" }, SECRET)).toBe(false);
    expect(verifyVnpayParams({ ...PARAMS, vnp_SecureHash: HASH.slice(0, 64) }, SECRET)).toBe(false);
    expect(verifyVnpayParams(signed, "khac")).toBe(false);
  });

  it("giá trị rỗng vẫn được ký (VNPay gửi vnp_BankTranNo rỗng): thêm chữ ký đúng thì hợp lệ", () => {
    const p = { ...PARAMS, vnp_BankTranNo: "" };
    expect(verifyVnpayParams({ ...p, vnp_SecureHash: signVnpayParams(p, SECRET) }, SECRET)).toBe(true);
  });
});

describe("định dạng", () => {
  it("ngày theo giờ GMT+7: không lệch ngày quanh nửa đêm UTC", () => {
    expect(formatVnpayDate(new Date("2026-10-31T13:15:00.000Z"))).toBe("20261031201500");
    expect(formatVnpayDate(new Date("2026-10-31T17:30:05.000Z"))).toBe("20261101003005");
    expect(formatVnpayDate(new Date("2026-12-31T20:00:00.000Z"))).toBe("20270101030000");
  });

  it("vnp_OrderInfo: bỏ dấu, bỏ ký tự đặc biệt, không rỗng, tối đa 255", () => {
    expect(vnpayOrderInfo("Thanh toán khoá học: sách-điện-tử #1!")).toBe("Thanh toan khoa hoc sach dien tu 1");
    expect(vnpayOrderInfo("???")).toBe("Thanh toan khoa hoc");
    expect(vnpayOrderInfo("a".repeat(400))).toHaveLength(255);
  });
});

describe("getVnpayConfig", () => {
  // Dấu ngoặc nhọn là cố ý: hook trả về một hàm thì Vitest coi đó là hàm dọn dẹp và gọi nó sau mỗi test.
  beforeEach(() => {
    getIntegrationSecret.mockReset();
  });
  const answer = (m: Record<string, string>) =>
    getIntegrationSecret.mockImplementation((k: string) =>
      k in m ? Promise.resolve(m[k]) : Promise.reject(new Error("key_not_found")),
    );

  it("đủ mã website và khoá bí mật: trả cấu hình, địa chỉ trống → sandbox", async () => {
    answer({ "vnpay.tmn_code": " ABCD1234 ", "vnpay.secret": SECRET });
    expect(await getVnpayConfig()).toEqual({ tmnCode: "ABCD1234", hashSecret: SECRET, paymentUrl: VNPAY_SANDBOX_URL });
  });

  it("dùng địa chỉ đã đặt (production)", async () => {
    answer({ "vnpay.tmn_code": "ABCD1234", "vnpay.secret": SECRET, "vnpay.payment_url": "https://pay.vnpay.vn/vpcpay.html" });
    expect((await getVnpayConfig())?.paymentUrl).toBe("https://pay.vnpay.vn/vpcpay.html");
  });

  it("thiếu mã website hoặc khoá bí mật → null (chưa cấu hình)", async () => {
    answer({ "vnpay.secret": SECRET });
    expect(await getVnpayConfig()).toBeNull();
    answer({ "vnpay.tmn_code": "ABCD1234" });
    expect(await getVnpayConfig()).toBeNull();
    answer({});
    expect(await getVnpayConfig()).toBeNull();
  });
});
