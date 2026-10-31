import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { processChargeRefund } from "../orderRefund";
import { extendEnrollmentAccess } from "../courseAccess";
import { isUserEnrolled, resolveDefaultSectionId } from "../enroll";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";

async function makeUser(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}

/** Khoá + học viên đã trả tiền (đơn paid có payment_intent) và đã có ghi danh active. */
async function paidLearner(slug: string, opts: { pi?: string; enroll?: boolean } = {}) {
  const owner = await makeUser(`${slug}-owner@e.com`);
  const learner = await makeUser(`${slug}-learner@e.com`);
  const { courseId } = await createCourse(owner, { title: `t ${slug}`, description: "d", slug });
  const pi = opts.pi ?? `pi_${slug}`;
  const order = await prisma.order.create({
    data: {
      userId: learner,
      courseId,
      amountCents: 199_000,
      currency: "VND",
      provider: "stripe",
      status: "paid",
      providerRef: `cs_${slug}`,
      paymentIntentRef: pi,
      paidAt: new Date(),
    },
  });
  if (opts.enroll !== false) {
    const sectionId = await resolveDefaultSectionId(courseId, prisma);
    await prisma.enrollment.create({ data: { userId: learner, courseId, sectionId, courseVersion: 1, status: "active" } });
  }
  return { owner, learner, courseId, order, pi };
}

const full = (pi: string, refundedCents = 199_000) => ({ paymentIntentRef: pi, refundedCents, fullyRefunded: true });
const partial = (pi: string, refundedCents: number) => ({ paymentIntentRef: pi, refundedCents, fullyRefunded: false });

describe("processChargeRefund — hoàn toàn bộ", () => {
  it("đơn → refunded, ghi danh → refunded, một sự kiện không mang số tiền; lịch sử học giữ nguyên", async () => {
    const { learner, courseId, order, pi } = await paidLearner("rf-1");
    await prisma.learningEvent.create({ data: { userId: learner, courseId, eventType: "lesson.viewed", payload: {} } });
    expect(await isUserEnrolled(learner, courseId)).toBe(true);

    const r = await processChargeRefund(full(pi));
    expect(r).toEqual({ result: "refunded", orderId: order.id, enrollmentRevoked: true });

    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe("refunded");
    expect(o.refundedAt).toBeInstanceOf(Date);
    expect(o.refundedCents).toBe(199_000);
    const e = await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: learner, courseId } } });
    expect(e.status).toBe("refunded");
    expect(await isUserEnrolled(learner, courseId)).toBe(false);

    const events = await prisma.learningEvent.findMany({ where: { eventType: LearningEventType.EnrollmentRefunded } });
    expect(events).toHaveLength(1);
    expect(events[0]!.userId).toBe(learner);
    expect(events[0]!.payload).toEqual({ enrollmentId: e.id, courseId, orderId: order.id }); // không có số tiền
    // lịch sử học còn nguyên
    expect(await prisma.learningEvent.count({ where: { userId: learner, eventType: "lesson.viewed" } })).toBe(1);
  });

  it("idempotent: gửi lại cùng sự kiện không đổi gì thêm và không ghi sự kiện thứ hai", async () => {
    const { pi, order } = await paidLearner("rf-2");
    await processChargeRefund(full(pi));
    const refundedAt = (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).refundedAt;

    expect(await processChargeRefund(full(pi))).toEqual({ result: "already_refunded", orderId: order.id });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).refundedAt!.getTime()).toBe(refundedAt!.getTime());
    expect(await prisma.learningEvent.count({ where: { eventType: LearningEventType.EnrollmentRefunded } })).toBe(1);
  });

  it("hai lần gửi đồng thời: đúng một bên xử lý, một sự kiện", async () => {
    const { pi } = await paidLearner("rf-3");
    const [a, b] = await Promise.all([processChargeRefund(full(pi)), processChargeRefund(full(pi))]);
    expect([a.result, b.result].sort()).toEqual(["already_refunded", "refunded"]);
    expect(await prisma.learningEvent.count({ where: { eventType: LearningEventType.EnrollmentRefunded } })).toBe(1);
  });

  it("mua lại sau khi hoàn: extendEnrollmentAccess mở lại, trạng thái về active", async () => {
    const { learner, courseId, pi } = await paidLearner("rf-4");
    await processChargeRefund(full(pi));
    expect(await isUserEnrolled(learner, courseId)).toBe(false);
    await extendEnrollmentAccess(learner, { id: courseId, version: 1 }, { id: null, durationMonths: null });
    expect(await isUserEnrolled(learner, courseId)).toBe(true);
  });
});

describe("processChargeRefund — còn lý do khác để giữ quyền", () => {
  it("có đơn paid khác cho cùng khoá: chỉ đơn bị hoàn đổi trạng thái, ghi danh giữ nguyên", async () => {
    const { learner, courseId, order, pi } = await paidLearner("rf-5");
    await prisma.order.create({
      data: { userId: learner, courseId, amountCents: 99_000, currency: "VND", status: "paid", providerRef: "cs_rf-5-b", paymentIntentRef: "pi_rf-5-b", paidAt: new Date() },
    });
    expect(await processChargeRefund(full(pi))).toEqual({ result: "refunded", orderId: order.id, enrollmentRevoked: false });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("refunded");
    expect(await isUserEnrolled(learner, courseId)).toBe(true);
    expect(await prisma.learningEvent.count({ where: { eventType: LearningEventType.EnrollmentRefunded } })).toBe(0);
  });

  it("đơn paid khác đã hoàn rồi thì không còn là lý do giữ quyền", async () => {
    const { learner, courseId, pi } = await paidLearner("rf-6");
    await prisma.order.create({
      data: { userId: learner, courseId, amountCents: 99_000, currency: "VND", status: "refunded", providerRef: "cs_rf-6-b", paymentIntentRef: "pi_rf-6-b", refundedAt: new Date() },
    });
    expect((await processChargeRefund(full(pi))).result).toBe("refunded");
    expect(await isUserEnrolled(learner, courseId)).toBe(false);
  });

  it("đơn paid của khoá KHÁC không giữ quyền ở khoá này", async () => {
    const { learner, owner, courseId, pi } = await paidLearner("rf-7");
    const other = await createCourse(owner, { title: "khác", description: "d", slug: "rf-7-other" });
    await prisma.order.create({
      data: { userId: learner, courseId: other.courseId, amountCents: 99_000, currency: "VND", status: "paid", providerRef: "cs_rf-7-b", paidAt: new Date() },
    });
    await processChargeRefund(full(pi));
    expect(await isUserEnrolled(learner, courseId)).toBe(false);
  });

  it("học viên đã dùng mã kích hoạt cho khoá này: giữ quyền", async () => {
    const { learner, owner, courseId, pi } = await paidLearner("rf-8");
    await prisma.courseAccessCode.create({
      data: { courseId, code: "RFRF-8888-RFRF", createdBy: owner, status: "redeemed", redeemedByUserId: learner, redeemedAt: new Date() },
    });
    expect((await processChargeRefund(full(pi))) as { enrollmentRevoked: boolean }).toMatchObject({ result: "refunded", enrollmentRevoked: false });
    expect(await isUserEnrolled(learner, courseId)).toBe(true);
  });

  it("mã kích hoạt chưa dùng hoặc đã thu hồi, hoặc do người khác dùng, không giữ quyền", async () => {
    const { learner, owner, courseId, pi } = await paidLearner("rf-9");
    const other = await makeUser("rf-9-other@e.com");
    await prisma.courseAccessCode.createMany({
      data: [
        { courseId, code: "RF91-AAAA-AAAA", createdBy: owner, status: "unused" },
        { courseId, code: "RF92-AAAA-AAAA", createdBy: owner, status: "revoked" },
        { courseId, code: "RF93-AAAA-AAAA", createdBy: owner, status: "redeemed", redeemedByUserId: other, redeemedAt: new Date() },
      ],
    });
    await processChargeRefund(full(pi));
    expect(await isUserEnrolled(learner, courseId)).toBe(false);
  });

  it("không có ghi danh (đã bị xoá tay): đơn vẫn refunded, không lỗi, không sự kiện", async () => {
    const { pi, order } = await paidLearner("rf-10", { enroll: false });
    expect(await processChargeRefund(full(pi))).toEqual({ result: "refunded", orderId: order.id, enrollmentRevoked: false });
    expect(await prisma.learningEvent.count({ where: { eventType: LearningEventType.EnrollmentRefunded } })).toBe(0);
  });
});

describe("processChargeRefund — hoàn một phần", () => {
  it("đơn vẫn paid, quyền giữ nguyên, chỉ ghi số tiền đã hoàn; không có sự kiện thu hồi", async () => {
    const { learner, courseId, order, pi } = await paidLearner("rf-11");
    expect(await processChargeRefund(partial(pi, 50_000))).toEqual({ result: "partial", orderId: order.id });
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o).toMatchObject({ status: "paid", refundedCents: 50_000, refundedAt: null });
    expect(await isUserEnrolled(learner, courseId)).toBe(true);
    expect(await prisma.learningEvent.count({ where: { eventType: LearningEventType.EnrollmentRefunded } })).toBe(0);
  });

  it("hoàn từng phần rồi hoàn nốt: lần hoàn đủ thu hồi quyền", async () => {
    const { learner, courseId, pi } = await paidLearner("rf-12");
    await processChargeRefund(partial(pi, 50_000));
    expect((await processChargeRefund(full(pi, 199_000))).result).toBe("refunded");
    expect(await isUserEnrolled(learner, courseId)).toBe(false);
  });

  it("sự kiện cũ đến muộn không kéo số tiền đã hoàn lùi, cũng không làm đơn đã hoàn hết hoàn lại thành paid", async () => {
    const { order, pi } = await paidLearner("rf-13");
    await processChargeRefund(partial(pi, 120_000));
    await processChargeRefund(partial(pi, 50_000)); // đến muộn
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).refundedCents).toBe(120_000);

    await processChargeRefund(full(pi));
    await processChargeRefund(partial(pi, 50_000)); // đến muộn sau khi đã hoàn hết
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe("refunded");
    expect(o.refundedCents).toBe(199_000);
  });
});

describe("processChargeRefund — không khớp đơn", () => {
  it("payment_intent không thuộc đơn nào (đơn trước AC4) → order_not_found, không đụng gì", async () => {
    const { learner, courseId } = await paidLearner("rf-14");
    expect(await processChargeRefund(full("pi_khong_co"))).toEqual({ result: "order_not_found" });
    expect(await isUserEnrolled(learner, courseId)).toBe(true);
  });

  it("đơn chưa paid (pending) → not_paid, đơn và ghi danh không đổi", async () => {
    const { learner, courseId, order, pi } = await paidLearner("rf-15");
    await prisma.order.update({ where: { id: order.id }, data: { status: "pending" } });
    expect(await processChargeRefund(full(pi))).toEqual({ result: "not_paid", orderId: order.id });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("pending");
    expect(await isUserEnrolled(learner, courseId)).toBe(true);
  });
});
