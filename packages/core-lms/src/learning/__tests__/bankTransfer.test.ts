import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import {
  extractPaymentCodes,
  generatePaymentCode,
  normalizeTransferContent,
  processBankTransaction,
} from "../bankTransfer";
import { isUserEnrolled } from "../enroll";
import { createCourse, publishCourse } from "../../courses/courses";
import { createBundle } from "../../courses/bundles";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";

const BASE = "http://localhost:3000";
async function makeUser(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}

describe("mã thanh toán", () => {
  it("generatePaymentCode: LM + 10 ký tự không có 0/O/1/I, không trùng", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const c = generatePaymentCode();
      expect(c).toMatch(/^LM[2-9A-HJ-NP-Z]{10}$/);
      seen.add(c);
    }
    expect(seen.size).toBe(200);
  });

  it("extractPaymentCodes: chịu được khoảng trắng, gạch, chữ thường và chữ thừa quanh mã", () => {
    expect(normalizeTransferContent("lm k7p3-q9xa 2r")).toBe("LMK7P3Q9XA2R");
    expect(extractPaymentCodes("LMK7P3Q9XA2R")).toEqual(["LMK7P3Q9XA2R"]);
    expect(extractPaymentCodes("NGUYEN VAN A chuyen tien lm k7p3-q9xa 2r cam on")).toEqual(["LMK7P3Q9XA2R"]);
    expect(extractPaymentCodes("MBVCB.123456.LMK7P3Q9XA2R.CT tu 0123")).toEqual(["LMK7P3Q9XA2R"]);
    expect(extractPaymentCodes("chuyen tien hoc phi")).toEqual([]);
    expect(extractPaymentCodes("LM0000000000")).toEqual([]); // 0/1/O/I không thuộc bảng
  });
});

/** Học viên có đơn chuyển khoản (khoá có gói 1 năm 199.000) đang chờ. */
async function pendingPlanOrder(tag: string) {
  const owner = await makeUser(`${tag}-owner@e.com`);
  const learner = await makeUser(`${tag}-learner@e.com`);
  const { courseId } = await createCourse(owner, { title: tag, description: "d", slug: tag, personalizationEnabled: false });
  await publishCourse(owner, courseId);
  const plan = await prisma.courseAccessPlan.create({
    data: { courseId, label: "1 năm", durationMonths: 12, priceCents: 199_000, currency: "VND", createdBy: owner },
  });
  const code = generatePaymentCode();
  const order = await prisma.order.create({
    data: { userId: learner, courseId, accessPlanId: plan.id, amountCents: 199_000, currency: "VND", provider: "sepay", status: "pending", providerRef: code },
  });
  return { owner, learner, courseId, order, code };
}
const tx = (id: number, content: string, amount = 199_000, extra: Record<string, unknown> = {}) => ({
  id,
  amount,
  content,
  transferType: "in",
  gateway: "Vietcombank",
  accountNumber: "0123456789",
  referenceCode: `FT${id}`,
  transactionDate: "2026-11-25 10:15:00",
  ...extra,
});

describe("processBankTransaction — đơn khoá có gói", () => {
  it("đúng tiền + đúng mã → đơn paid, ghi danh 1 năm, nhật ký matched", async () => {
    const { learner, courseId, order, code } = await pendingPlanOrder("bt-1");
    expect(await processBankTransaction(tx(1001, `${code} hoc phi`))).toEqual({ result: "matched", orderId: order.id, overpaidAmount: null });

    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o).toMatchObject({ status: "paid", gatewayTxnRef: "FT1001" });
    expect(o.paidAt).toBeInstanceOf(Date);
    expect(await isUserEnrolled(learner, courseId)).toBe(true);
    const e = await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: learner, courseId } } });
    expect((e.accessExpiresAt!.getTime() - Date.now()) / (30 * 24 * 3600 * 1000)).toBeGreaterThan(11);

    const log = await prisma.bankTransaction.findUniqueOrThrow({ where: { provider_externalId: { provider: "sepay", externalId: "1001" } } });
    expect(log).toMatchObject({ status: "matched", orderId: order.id, amount: 199_000, referenceCode: "FT1001" });
    expect(log.transactedAt?.toISOString()).toBe("2026-11-25T03:15:00.000Z"); // 10:15 giờ Việt Nam
  });

  it("chuyển thừa vẫn cấp quyền và ghi phần chênh; chuyển thiếu thì không cấp", async () => {
    const a = await pendingPlanOrder("bt-2");
    expect(await processBankTransaction(tx(1002, a.code, 250_000))).toMatchObject({ result: "matched", overpaidAmount: 51_000 });
    expect(await isUserEnrolled(a.learner, a.courseId)).toBe(true);

    const b = await pendingPlanOrder("bt-3");
    expect(await processBankTransaction(tx(1003, b.code, 100_000))).toEqual({ result: "amount_mismatch", orderId: b.order.id });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: b.order.id } })).status).toBe("pending");
    expect(await isUserEnrolled(b.learner, b.courseId)).toBe(false);
    // Rồi chuyển bù đúng số tiền ở giao dịch khác: đơn vẫn nhận được.
    expect(await processBankTransaction(tx(1004, b.code, 199_000))).toMatchObject({ result: "matched" });
    expect(await isUserEnrolled(b.learner, b.courseId)).toBe(true);
  });

  it("SePay gửi lại cùng id chỉ xử lý một lần; đơn đã paid nhận thêm tiền → duplicate_payment", async () => {
    const { learner, courseId, order, code } = await pendingPlanOrder("bt-4");
    await processBankTransaction(tx(1005, code));
    const before = await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: learner, courseId } } });

    expect(await processBankTransaction(tx(1005, code))).toEqual({ result: "duplicate" });
    expect(await processBankTransaction(tx(1006, code))).toEqual({ result: "duplicate_payment", orderId: order.id });
    const after = await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: learner, courseId } } });
    expect(after.accessExpiresAt!.getTime()).toBe(before.accessExpiresAt!.getTime()); // không gia hạn thêm
  });

  it("không khớp mã, tiền chuyển ra, sai tài khoản → không cấp quyền", async () => {
    const { learner, courseId, code } = await pendingPlanOrder("bt-5");
    expect(await processBankTransaction(tx(1007, "chuyen tien hoc phi"))).toEqual({ result: "unmatched" });
    expect(await processBankTransaction(tx(1008, code, 199_000, { transferType: "out" }))).toEqual({ result: "ignored" });
    expect(await processBankTransaction(tx(1009, code, 199_000, { accountNumber: "9999" }), { expectedAccountNumber: "0123456789" })).toEqual({ result: "ignored" });
    expect(await isUserEnrolled(learner, courseId)).toBe(false);
    expect(await prisma.bankTransaction.count({ where: { externalId: { in: ["1007", "1008", "1009"] } } })).toBe(3);
  });

  it("lỗi tạm thời: xoá nhật ký, ném lỗi; lần gửi lại xử lý được", async () => {
    const { learner, courseId, code } = await pendingPlanOrder("bt-6");
    let fail = true;
    const flaky = new Proxy(prisma, {
      get(target, prop) {
        const v = Reflect.get(target, prop) as unknown;
        if (prop === "order") {
          return new Proxy(v as object, {
            get(o, p) {
              const f = Reflect.get(o, p) as unknown;
              if (p === "findFirst" && fail) {
                return async () => {
                  fail = false;
                  throw new Error("boom");
                };
              }
              return typeof f === "function" ? (f as (...a: unknown[]) => unknown).bind(o) : f;
            },
          });
        }
        return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
      },
    }) as typeof prisma;

    await expect(processBankTransaction(tx(1010, code), {}, flaky)).rejects.toThrow("boom");
    expect(await prisma.bankTransaction.count({ where: { externalId: "1010" } })).toBe(0);
    expect(await isUserEnrolled(learner, courseId)).toBe(false);

    expect(await processBankTransaction(tx(1010, code), {}, flaky)).toMatchObject({ result: "matched" });
    expect(await isUserEnrolled(learner, courseId)).toBe(true);
  });
});

describe("processBankTransaction — đơn combo", () => {
  it("một giao dịch đúng mã mở mọi khoá của combo", async () => {
    const admin = await makeUser("bt-7-admin@e.com");
    await grantRole(admin, { targetUserId: admin, roleName: RoleName.Admin });
    const learner = await makeUser("bt-7-learner@e.com");
    const courseIds: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const c = await createCourse(admin, { title: `bt7 ${i}`, description: "d", slug: `bt7-${i}`, personalizationEnabled: false });
      await publishCourse(admin, c.courseId);
      courseIds.push(c.courseId);
    }
    const bundle = await createBundle(admin, { slug: "combo-bt7", title: "Combo", priceCents: 799_000, durationMonths: 12, courseIds });
    const code = generatePaymentCode();
    const order = await prisma.order.create({
      data: { userId: learner, courseId: null, bundleId: bundle.id, amountCents: 799_000, currency: "VND", provider: "sepay", status: "pending", providerRef: code },
    });

    expect(await processBankTransaction(tx(1011, `thanh toan ${code}`, 799_000))).toEqual({ result: "matched", orderId: order.id, overpaidAmount: null });
    for (const courseId of courseIds) expect(await isUserEnrolled(learner, courseId)).toBe(true);
  });
});
