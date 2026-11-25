import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@feedbackme/db";

const { sendTemplatedEmail } = vi.hoisted(() => ({ sendTemplatedEmail: vi.fn() }));
vi.mock("../../email/templates", async (orig) => ({ ...(await orig<typeof import("../../email/templates")>()), sendTemplatedEmail }));

import { settleGatewayPayment } from "../orderPayment";
import { redeemAnyCode } from "../bundleCode";
import { accessText, formatOrderAmount } from "../purchaseEmail";
import { createCourse, publishCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { generateAccessCodes } from "../accessCode";

const BASE = "http://localhost:3000";
const SITE = "https://limio.vn";
async function makeUser(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: "Học viên " + email }, BASE)).userId;
}
beforeEach(() => sendTemplatedEmail.mockReset().mockResolvedValue({ delivered: true, loggedOnly: false, source: "fallback" }));

async function pendingOrder(tag: string) {
  const owner = await makeUser(`pe-owner-${tag}@e.com`);
  const learner = await makeUser(`pe-learner-${tag}@e.com`);
  const { courseId } = await createCourse(owner, { title: "Khoá thử email", description: "d", slug: `pe-${tag}`, personalizationEnabled: false });
  await publishCourse(owner, courseId);
  const plan = await prisma.courseAccessPlan.create({
    data: { courseId, label: "1 năm", durationMonths: 12, priceCents: 199_000, currency: "VND", createdBy: owner },
  });
  const order = await prisma.order.create({
    data: { userId: learner, courseId, accessPlanId: plan.id, amountCents: 199_000, currency: "VND", provider: "sepay_pg", status: "pending", providerRef: `LMPE${tag}` },
  });
  return { owner, learner, courseId, order };
}

describe("email xác nhận đơn hàng", () => {
  it("đơn thanh toán thành công + có baseUrl → gửi đúng một email biên nhận, IPN gửi lại không gửi thêm", async () => {
    const { order } = await pendingOrder("a1");
    sendTemplatedEmail.mockClear(); // bỏ email xác thực tài khoản lúc dựng dữ liệu
    const ipn = { provider: "sepay_pg" as const, txnRef: "LMPEa1", paidAmountCents: 199_000, success: true, gatewayTxnRef: "T1" };
    expect((await settleGatewayPayment(ipn, prisma, { baseUrl: SITE })).result).toBe("paid");
    expect(sendTemplatedEmail).toHaveBeenCalledTimes(1);
    const call = sendTemplatedEmail.mock.calls[0]![0];
    expect(call.key).toBe("order.confirmation");
    expect(call.to).toBe("pe-learner-a1@e.com");
    expect(call.variables).toMatchObject({ orderCode: "LMPEa1", itemTitle: "Khoá thử email", methodLabel: "SePay (QR, thẻ)", actionUrl: `${SITE}/learn/pe-a1` });
    expect(call.variables.amountText).toContain("199.000");
    expect(call.variables.accessText).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(order.id).toBeTruthy();

    expect((await settleGatewayPayment(ipn, prisma, { baseUrl: SITE })).result).toBe("already_confirmed");
    expect(sendTemplatedEmail).toHaveBeenCalledTimes(1);
  });

  it("không có baseUrl thì không gửi; thanh toán sai số tiền hay thất bại thì không gửi", async () => {
    await pendingOrder("a2");
    sendTemplatedEmail.mockClear();
    const ipn = { provider: "sepay_pg" as const, txnRef: "LMPEa2", paidAmountCents: 1, success: true };
    await settleGatewayPayment(ipn, prisma, { baseUrl: SITE });
    await settleGatewayPayment({ ...ipn, paidAmountCents: 199_000, success: false }, prisma, { baseUrl: SITE });
    expect(sendTemplatedEmail).not.toHaveBeenCalled();
    await settleGatewayPayment({ ...ipn, paidAmountCents: 199_000, success: true }); // không baseUrl
    expect(sendTemplatedEmail).not.toHaveBeenCalled();
  });

  it("gửi email lỗi không làm hỏng việc cấp quyền", async () => {
    const { learner, courseId } = await pendingOrder("a3");
    // Chỉ email xác nhận đơn lỗi; email khác (vd cấp thưởng) vẫn gửi được.
    sendTemplatedEmail.mockReset().mockImplementation(async (a?: { key: string }) => {
      if (a?.key === "order.confirmation") throw new Error("smtp down");
      return { delivered: true, loggedOnly: false, source: "fallback" };
    });
    const r = await settleGatewayPayment({ provider: "sepay_pg", txnRef: "LMPEa3", paidAmountCents: 199_000, success: true }, prisma, { baseUrl: SITE });
    expect(r.result).toBe("paid");
    expect(await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: learner, courseId } } })).not.toBeNull();
  });
});

describe("email kích hoạt bằng mã", () => {
  it("đổi mã khoá thành công → một email 'đã kích hoạt' (không có mã, không có số tiền), không kèm email chào mừng", async () => {
    const owner = await makeUser("pe-owner-c1@e.com");
    const learner = await makeUser("pe-learner-c1@e.com");
    const { courseId } = await createCourse(owner, { title: "Khoá mã", description: "d", slug: "pe-code-1", personalizationEnabled: false });
    await publishCourse(owner, courseId);
    const [code] = await generateAccessCodes(courseId, owner, 1);
    sendTemplatedEmail.mockClear();
    await redeemAnyCode(learner, code!.code, prisma, { baseUrl: SITE });
    expect(sendTemplatedEmail).toHaveBeenCalledTimes(1);
    const call = sendTemplatedEmail.mock.calls[0]![0];
    expect(call.key).toBe("course.activated");
    expect(call.variables.actionUrl).toBe(`${SITE}/learn/pe-code-1`);
    expect(JSON.stringify(call.variables)).not.toContain(code!.code);
  });
});

describe("định dạng", () => {
  it("số tiền VND và hạn truy cập", () => {
    expect(formatOrderAmount(199_000, "VND")).toContain("199.000");
    expect(accessText([null])).toBe("Không giới hạn thời gian");
    expect(accessText([new Date("2027-11-25T10:00:00Z"), null])).toBe("25/11/2027");
    expect(accessText([])).toBe("Đã mở");
  });
});
