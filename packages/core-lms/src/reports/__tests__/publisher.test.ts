import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType, lessonSkillCode } from "@feedbackme/shared-types";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";
import { createCourse, publishCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { canEditCourse, canGradeCourse, canModerateLiveExam } from "../../courses/authz";
import { enrollInCourse } from "../../learning/enroll";
import { canViewCourseReport, hasAnyReportAccess, listReportCourses } from "../access";
import { grantReportViewer, listReportViewers, ReportViewerError, revokeReportViewer } from "../viewers";
import {
  exportRevenueCsv,
  getActivationReport,
  getHardestQuestions,
  getLearnerReport,
  getMasteryByLesson,
  getRemediationUptake,
  getRevenueReport,
  REPORT_MIN_GROUP,
  vnMonthKey,
  vnWeekKey,
} from "../publisher";

const BASE = "http://localhost:3000";
let seq = 0;
const uniq = () => `${Date.now()}-${++seq}`;

async function makeUser(prefix: string) {
  return (await registerUser({ email: `${prefix}-${uniq()}@e.com`, password: "password1234", displayName: prefix }, BASE)).userId;
}

async function makeLearners(n: number, prefix = "hv"): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const u = await prisma.user.create({ data: { email: `${prefix}-${uniq()}@e.com`, displayName: `Học viên ${prefix} ${i}` } });
    ids.push(u.id);
  }
  return ids;
}

async function makeOrg() {
  const code = `ORG-RPT-${uniq()}`;
  return prisma.organization.create({ data: { code, name: `NXB ${code}` } });
}

/** Khoá miễn phí đã xuất bản, 1 chương 2 bài; trả cả id bài. */
async function makeCourse(ownerId: string, opts: { organizationId?: string; personalization?: boolean } = {}) {
  const slug = `rpt-${uniq()}`;
  const c = await createCourse(ownerId, { title: `Sách ${slug}`, description: "d", slug });
  const m = await createModule(ownerId, c.courseId, { title: "Chương 1", orderIndex: 0 });
  const l1 = await createLesson(ownerId, m.moduleId, { title: "Bài 1", orderIndex: 0 });
  const l2 = await createLesson(ownerId, m.moduleId, { title: "Bài 2", orderIndex: 1 });
  await publishCourse(ownerId, c.courseId);
  await prisma.course.update({
    where: { id: c.courseId },
    data: { organizationId: opts.organizationId ?? null, personalizationEnabled: opts.personalization ?? false },
  });
  return { courseId: c.courseId, lesson1: l1.lessonId, lesson2: l2.lessonId };
}

async function enrollAll(courseId: string, userIds: string[]) {
  for (const u of userIds) await enrollInCourse(u, courseId);
}

/** Kiểm JSON không chứa email/tên/userId của học viên nào. */
async function expectNoPii(result: unknown, userIds: string[]) {
  const json = JSON.stringify(result);
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, displayName: true } });
  for (const u of users) {
    expect(json).not.toContain(u.id);
    expect(json).not.toContain(u.email);
    expect(json).not.toContain(u.displayName);
  }
}

describe("AC1 — quyền xem báo cáo", () => {
  it("người được cấp 'Xem báo cáo' xem được khoá của tổ chức nhưng không sửa, không chấm, không điều hành", async () => {
    const owner = await makeUser("owner");
    const orgAdmin = await makeUser("orgadmin");
    const viewer = await makeUser("viewer");
    const stranger = await makeUser("stranger");
    const org = await makeOrg();
    await prisma.organizationAdmin.create({ data: { organizationId: org.id, userId: orgAdmin } });
    const { courseId } = await makeCourse(owner, { organizationId: org.id });

    expect(await canViewCourseReport(viewer, courseId)).toBe(false);
    await grantReportViewer(orgAdmin, org.id, (await prisma.user.findUniqueOrThrow({ where: { id: viewer } })).email);

    expect(await canViewCourseReport(viewer, courseId)).toBe(true);
    expect(await canViewCourseReport(orgAdmin, courseId)).toBe(true);
    expect(await canViewCourseReport(owner, courseId)).toBe(true);
    expect(await canViewCourseReport(stranger, courseId)).toBe(false);

    // Không hồi quy: quyền xem không ngầm cấp quyền nào khác.
    expect(await canEditCourse(viewer, courseId)).toBe(false);
    expect(await canGradeCourse(viewer, courseId)).toBe(false);
    expect(await canModerateLiveExam(viewer, courseId)).toBe(false);
    expect(await prisma.courseInstructor.count({ where: { userId: viewer } })).toBe(0);

    const courses = await listReportCourses(viewer);
    expect(courses.map((c) => c.id)).toEqual([courseId]);
    expect(courses[0]!.organizationName).toBe(org.name);
    expect(await hasAnyReportAccess(viewer)).toBe(true);
    expect(await hasAnyReportAccess(stranger)).toBe(false);
  });

  it("khoá không thuộc tổ chức thì người xem của tổ chức không thấy", async () => {
    const owner = await makeUser("owner");
    const viewer = await makeUser("viewer");
    const org = await makeOrg();
    await prisma.organizationReportViewer.create({ data: { organizationId: org.id, userId: viewer } });
    const { courseId } = await makeCourse(owner);
    expect(await canViewCourseReport(viewer, courseId)).toBe(false);
    expect(await listReportCourses(viewer)).toEqual([]);
  });

  it("giảng viên chỉ thấy khoá CÓ BÁN của mình trong danh sách", async () => {
    const owner = await makeUser("owner");
    const free = await makeCourse(owner);
    const sold = await makeCourse(owner);
    await prisma.course.update({ where: { id: sold.courseId }, data: { priceCents: 150_000 } });
    const ids = (await listReportCourses(owner)).map((c) => c.id);
    expect(ids).toContain(sold.courseId);
    expect(ids).not.toContain(free.courseId);
  });

  it("chỉ OrgAdmin cấp/thu được quyền; mỗi lần ghi AuditLog và sự kiện", async () => {
    const orgAdmin = await makeUser("orgadmin");
    const other = await makeUser("other");
    const target = await makeUser("target");
    const org = await makeOrg();
    await prisma.organizationAdmin.create({ data: { organizationId: org.id, userId: orgAdmin } });
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: target } })).email;

    await expect(grantReportViewer(other, org.id, email)).rejects.toMatchObject({ code: "forbidden" });
    await grantReportViewer(orgAdmin, org.id, `  ${email.toUpperCase()} `);
    await expect(grantReportViewer(orgAdmin, org.id, email)).rejects.toBeInstanceOf(ReportViewerError);
    await expect(grantReportViewer(orgAdmin, org.id, "khong-co@e.com")).rejects.toMatchObject({ code: "user_not_found" });

    const list = await listReportViewers(orgAdmin, org.id);
    expect(list.map((r) => r.userId)).toEqual([target]);

    await revokeReportViewer(orgAdmin, org.id, target);
    await expect(revokeReportViewer(orgAdmin, org.id, target)).rejects.toMatchObject({ code: "not_viewer" });

    const audits = await prisma.auditLog.findMany({ where: { targetUserId: target }, orderBy: { occurredAt: "asc" } });
    expect(audits.map((a) => a.action)).toEqual(["report_viewer.granted", "report_viewer.revoked"]);
    const events = await prisma.learningEvent.findMany({
      where: { eventType: { in: [LearningEventType.ReportViewerGranted, LearningEventType.ReportViewerRevoked] } },
    });
    expect(events).toHaveLength(2);
  });
});

describe("mốc thời gian giờ Việt Nam", () => {
  it("tuần bắt đầu thứ Hai, 23:30 Chủ nhật giờ VN vẫn thuộc tuần cũ", () => {
    // 2026-11-15 là Chủ nhật. 16:30Z = 23:30 giờ VN.
    expect(vnWeekKey(new Date("2026-11-15T16:30:00Z"))).toBe("2026-11-09");
    // 17:30Z = 00:30 thứ Hai giờ VN.
    expect(vnWeekKey(new Date("2026-11-15T17:30:00Z"))).toBe("2026-11-16");
    expect(vnMonthKey(new Date("2026-10-31T18:00:00Z"))).toBe("2026-11");
  });
});

describe("AC2 — phát hành", () => {
  it("đếm theo lô, tỉ lệ bỏ mã thu hồi khỏi mẫu số, cảnh báo sắp hết hạn kích hoạt, không lộ mã hay người kích hoạt", async () => {
    const owner = await makeUser("owner");
    const { courseId } = await makeCourse(owner);
    const learners = await makeLearners(3);
    const now = new Date("2026-11-16T03:00:00Z");
    const soon = new Date("2026-12-01T16:59:59Z");
    const batch = await prisma.courseAccessCodeBatch.create({
      data: { courseId, label: "Đợt in 1", count: 6, createdBy: owner, activateBefore: soon, accessDurationMonths: 12 },
    });
    const mk = (i: number, status: "unused" | "redeemed" | "revoked", userId?: string, at?: Date) =>
      prisma.courseAccessCode.create({
        data: {
          courseId,
          batchId: batch.id,
          code: `RPT${uniq()}${i}`.slice(0, 30),
          status,
          createdBy: owner,
          redeemedByUserId: userId ?? null,
          redeemedAt: at ?? null,
        },
      });
    await mk(1, "redeemed", learners[0]!, new Date("2026-11-10T02:00:00Z"));
    await mk(2, "redeemed", learners[1]!, new Date("2026-11-11T02:00:00Z"));
    await mk(3, "redeemed", learners[2]!, new Date("2026-11-03T02:00:00Z"));
    await mk(4, "unused");
    await mk(5, "revoked");
    await mk(6, "unused");
    await prisma.courseAccessCode.create({ data: { courseId, code: `LOOSE${uniq()}`.slice(0, 30), status: "unused", createdBy: owner } });

    const r = await getActivationReport(courseId, { range: 30, now });
    const b = r.batches.find((x) => x.batchId === batch.id)!;
    expect(b).toMatchObject({ total: 6, redeemed: 3, unused: 2, revoked: 1, expiringSoon: true, activationClosed: false });
    expect(b.activationRate).toBeCloseTo(3 / 5);
    expect(r.batches.find((x) => x.batchId === null)).toMatchObject({ label: "Mã lẻ", total: 1, unused: 1 });
    expect(r.weekly.find((w) => w.week === "2026-11-09")?.count).toBe(2);
    expect(r.weekly.find((w) => w.week === "2026-11-02")?.count).toBe(1);
    expect(r.weekly.at(-1)?.week).toBe("2026-11-16");

    const json = JSON.stringify(r);
    const codes = await prisma.courseAccessCode.findMany({ where: { courseId }, select: { code: true } });
    for (const c of codes) expect(json).not.toContain(c.code);
    await expectNoPii(r, learners);
  });
});

describe("AC3 — doanh thu", () => {
  it("tách theo tiền tệ, tính hoàn hết và hoàn một phần, đếm đơn chưa hoàn tất; CSV có BOM và không có người mua", async () => {
    const owner = await makeUser("owner");
    const { courseId } = await makeCourse(owner);
    const buyers = await makeLearners(4, "mua");
    const plan = await prisma.courseAccessPlan.create({
      data: { courseId, label: "1 năm", durationMonths: 12, priceCents: 200_000, currency: "VND", createdBy: owner },
    });
    const now = new Date("2026-11-16T03:00:00Z");
    const order = (userId: string, data: Record<string, unknown>) =>
      prisma.order.create({ data: { userId, courseId, amountCents: 200_000, currency: "VND", provider: "vnpay", accessPlanId: plan.id, ...data } });
    await order(buyers[0]!, { status: "paid", paidAt: new Date("2026-11-02T03:00:00Z"), gatewayTxnRef: "VNP-001" });
    await order(buyers[1]!, { status: "refunded", paidAt: new Date("2026-11-03T03:00:00Z"), refundedAt: new Date("2026-11-05T03:00:00Z") });
    await order(buyers[2]!, { status: "paid", paidAt: new Date("2026-09-20T03:00:00Z"), refundedCents: 50_000, refundedAt: new Date("2026-09-25T03:00:00Z") });
    await order(buyers[3]!, { status: "paid", paidAt: new Date("2026-11-04T03:00:00Z"), amountCents: 999, currency: "USD", provider: "stripe", accessPlanId: null, paymentIntentRef: "pi_123" });
    await order(buyers[3]!, { status: "pending" });
    await order(buyers[3]!, { status: "failed" });

    const r = await getRevenueReport(courseId, { range: 90, now });
    expect(r.currencies.map((c) => c.currency)).toEqual(["VND", "USD"]);
    const vnd = r.currencies[0]!;
    expect(vnd.totals).toEqual({ orders: 3, gross: 600_000, refunded: 250_000, net: 350_000 });
    expect(vnd.monthly).toEqual([
      { month: "2026-09", orders: 1, gross: 200_000, refunded: 50_000, net: 150_000 },
      { month: "2026-11", orders: 2, gross: 400_000, refunded: 200_000, net: 200_000 },
    ]);
    expect(vnd.byPlan).toEqual([{ plan: "1 năm", orders: 3, gross: 600_000, refunded: 250_000, net: 350_000 }]);
    expect(r.currencies[1]!.totals).toEqual({ orders: 1, gross: 999, refunded: 0, net: 999 });
    expect(r.incompleteOrders).toBe(2);
    await expectNoPii(r, buyers);

    const short = await getRevenueReport(courseId, { range: 30, now });
    expect(short.currencies[0]!.totals.orders).toBe(2);

    const { csv, filename } = await exportRevenueCsv(courseId, prisma, now);
    expect(filename).toMatch(/^doi-soat-rpt-.*-2026-11-16\.csv$/);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split("\r\n");
    expect(lines).toHaveLength(5); // tiêu đề + 4 đơn đã thanh toán/hoàn
    expect(lines[0]).toContain("Mã giao dịch của cổng");
    expect(csv).toContain("VNP-001");
    expect(csv).toContain("Đã hoàn một phần");
    await expectNoPii(csv, buyers);
  });
});

describe("AC4 — người học", () => {
  it("tách nguồn ghi danh, đếm người hoạt động 30 ngày theo hoạt động học, không lộ danh tính", async () => {
    const owner = await makeUser("owner");
    const { courseId, lesson1 } = await makeCourse(owner);
    const [viaCode, viaOrder, both, other] = (await makeLearners(4)) as [string, string, string, string];
    await enrollAll(courseId, [viaCode, viaOrder, both, other]);
    await prisma.courseAccessCode.create({ data: { courseId, code: `C${uniq()}`.slice(0, 30), status: "redeemed", createdBy: owner, redeemedByUserId: viaCode, redeemedAt: new Date() } });
    await prisma.courseAccessCode.create({ data: { courseId, code: `D${uniq()}`.slice(0, 30), status: "redeemed", createdBy: owner, redeemedByUserId: both, redeemedAt: new Date() } });
    await prisma.order.create({ data: { userId: viaOrder, courseId, amountCents: 1, status: "paid", paidAt: new Date() } });
    await prisma.order.create({ data: { userId: both, courseId, amountCents: 1, status: "paid", paidAt: new Date() } });

    await prisma.learningEvent.create({ data: { userId: viaCode, courseId, eventType: "lesson.viewed", payload: { lessonId: lesson1 } } });
    // Sự kiện do giáo viên thao tác không tính là hoạt động học.
    await prisma.learningEvent.create({ data: { userId: other, courseId, eventType: "attendance.student.marked", payload: {} } });

    const r = await getLearnerReport(courseId, { range: 30 });
    expect(r.enrolled).toBe(4);
    expect(r.bySource).toEqual({ accessCode: 2, directPurchase: 2, other: 1 });
    expect(r.activeLast30Days).toBe(1);
    expect(r.byStatus.active).toBe(4);
    await expectNoPii(r, [viaCode, viaOrder, both, other]);
  });
});

describe("AC5 — mức nắm vững theo bài", () => {
  it("khoá tắt cá nhân hoá thì báo tắt", async () => {
    const owner = await makeUser("owner");
    const { courseId } = await makeCourse(owner, { personalization: false });
    expect(await getMasteryByLesson(courseId)).toEqual({ enabled: false });
  });

  it("dưới k người thì không hiện tỉ lệ; đủ k thì dùng đúng ngưỡng nhãn của học viên", async () => {
    const owner = await makeUser("owner");
    const { courseId, lesson1, lesson2 } = await makeCourse(owner, { personalization: true });
    const learners = await makeLearners(REPORT_MIN_GROUP);
    await enrollAll(courseId, learners);
    const s1 = await prisma.skill.upsert({ where: { code: lessonSkillCode(lesson1) }, update: {}, create: { code: lessonSkillCode(lesson1), name: "Bài 1" } });
    const s2 = await prisma.skill.upsert({ where: { code: lessonSkillCode(lesson2) }, update: {}, create: { code: lessonSkillCode(lesson2), name: "Bài 2" } });
    // Bài 1: đủ 10 người — 4 dưới 0,6; 3 trong [0,6; 0,85); 3 từ 0,85 (0,85 đúng ngưỡng tính là Vững).
    const values = [0.1, 0.3, 0.5, 0.59, 0.6, 0.7, 0.84, 0.85, 0.9, 0.99];
    for (let i = 0; i < learners.length; i++) {
      await prisma.learnerSkillState.create({ data: { userId: learners[i]!, skillId: s1.id, masteryProbability: values[i]! } });
    }
    // Bài 2: chỉ 9 người có dữ liệu.
    for (let i = 0; i < REPORT_MIN_GROUP - 1; i++) {
      await prisma.learnerSkillState.create({ data: { userId: learners[i]!, skillId: s2.id, masteryProbability: 0.2 } });
    }
    // Người không ghi danh khoá không được tính.
    const outsider = (await makeLearners(1, "ngoai"))[0]!;
    await prisma.learnerSkillState.create({ data: { userId: outsider, skillId: s2.id, masteryProbability: 0.2 } });

    const r = await getMasteryByLesson(courseId);
    if (!r.enabled) throw new Error("expected enabled");
    const b1 = r.lessons[0]!;
    const b2 = r.lessons[1]!;
    expect(b1).toMatchObject({ insufficient: false, learners: 10, reviewPct: 40, practicePct: 30, solidPct: 30, mostNeedsReview: true });
    expect(b2.insufficient).toBe(true);
    expect(b2.reviewPct).toBeUndefined();
    expect(b2.learners).toBeUndefined();
    await expectNoPii(r, learners);
  });
});

async function makeQuiz(courseId: string, lessonId: string) {
  const quiz = await prisma.quiz.create({ data: { title: "Kiểm tra nhanh", courseId, lessonId } });
  const mis = await prisma.misconception.create({ data: { code: `mis.${uniq()}`, name: "Quên điều kiện a khác 0", description: "d" } });
  const q = await prisma.quizQuestion.create({ data: { quizId: quiz.id, type: "mcq", prompt: "<p>Điều kiện của <b>phương trình bậc hai</b>?</p>", orderIndex: 0 } });
  const right = await prisma.questionOption.create({ data: { questionId: q.id, label: "a ≠ 0", isCorrect: true, orderIndex: 0 } });
  const wrong = await prisma.questionOption.create({ data: { questionId: q.id, label: "b ≠ 0", isCorrect: false, orderIndex: 1, misconceptionId: mis.id } });
  return { quizId: quiz.id, questionId: q.id, right: right.id, wrong: wrong.id };
}

describe("AC6 — câu hỏi bị sai nhiều", () => {
  it("chỉ tính lượt nộp đầu của mỗi người, cần đủ ngưỡng, chỉ ra phương án sai và nhầm lẫn", async () => {
    const owner = await makeUser("owner");
    const { courseId, lesson1 } = await makeCourse(owner);
    const learners = await makeLearners(REPORT_MIN_GROUP);
    await enrollAll(courseId, learners);
    const q = await makeQuiz(courseId, lesson1);

    for (let i = 0; i < learners.length; i++) {
      // 7 người sai ở lượt đầu, 3 người đúng.
      const firstCorrect = i >= 7;
      const a1 = await prisma.quizAttempt.create({ data: { quizId: q.quizId, userId: learners[i]!, status: "submitted", submittedAt: new Date(Date.now() - 60_000) } });
      await prisma.answerResponse.create({ data: { attemptId: a1.id, questionId: q.questionId, response: [firstCorrect ? q.right : q.wrong], isCorrect: firstCorrect, responseTimeMs: 1000 } });
      // Lượt sau ai cũng đúng — không được kéo tỉ lệ lên.
      const a2 = await prisma.quizAttempt.create({ data: { quizId: q.quizId, userId: learners[i]!, status: "submitted", submittedAt: new Date() } });
      await prisma.answerResponse.create({ data: { attemptId: a2.id, questionId: q.questionId, response: [q.right], isCorrect: true, responseTimeMs: 1000 } });
    }

    const r = await getHardestQuestions(courseId);
    expect(r).toHaveLength(1);
    expect(r[0]!.lessonTitle).toBe("Bài 1");
    expect(r[0]!.questions[0]).toMatchObject({
      prompt: "Điều kiện của phương trình bậc hai ?",
      responses: 10,
      correctPct: 30,
      topWrongOption: { label: "b ≠ 0", chosenPct: 70, misconception: "Quên điều kiện a khác 0" },
    });
    await expectNoPii(r, learners);
  });

  it("dưới ngưỡng lượt trả lời thì không liệt kê câu", async () => {
    const owner = await makeUser("owner");
    const { courseId, lesson1 } = await makeCourse(owner);
    const learners = await makeLearners(REPORT_MIN_GROUP - 1);
    await enrollAll(courseId, learners);
    const q = await makeQuiz(courseId, lesson1);
    for (const u of learners) {
      const a = await prisma.quizAttempt.create({ data: { quizId: q.quizId, userId: u, status: "submitted", submittedAt: new Date() } });
      await prisma.answerResponse.create({ data: { attemptId: a.id, questionId: q.questionId, response: [q.wrong], isCorrect: false, responseTimeMs: 1000 } });
    }
    expect(await getHardestQuestions(courseId)).toEqual([]);
  });
});

describe("AC7 — mức dùng phản hồi", () => {
  it("tỉ lệ phản hồi có gợi ý được bấm, theo tháng; dưới k người thì không hiện", async () => {
    const owner = await makeUser("owner");
    const { courseId, lesson1, lesson2 } = await makeCourse(owner);
    const learners = await makeLearners(REPORT_MIN_GROUP);
    await enrollAll(courseId, learners);
    const q = await makeQuiz(courseId, lesson1);
    const nov = new Date("2026-11-10T03:00:00Z");
    const oct = new Date("2026-10-10T03:00:00Z");

    for (let i = 0; i < learners.length; i++) {
      const a = await prisma.quizAttempt.create({ data: { quizId: q.quizId, userId: learners[i]!, status: "submitted", submittedAt: nov } });
      const d = await prisma.feedbackDelivery.create({
        data: { userId: learners[i]!, attemptId: a.id, questionId: q.questionId, body: "x", remediationLessonIds: [lesson2], deliveredAt: nov },
      });
      if (i < 4) {
        await prisma.learningEvent.create({
          data: { userId: learners[i]!, courseId, eventType: LearningEventType.FeedbackRemediationClicked, payload: { deliveryId: d.id, lessonId: lesson2 }, occurredAt: nov },
        });
      }
      // Phản hồi không gợi ý bài nào không tính vào mẫu số.
      await prisma.feedbackDelivery.create({ data: { userId: learners[i]!, attemptId: a.id, body: "y", remediationLessonIds: [], deliveredAt: nov } });
    }
    // Tháng 10: chỉ 2 người.
    for (let i = 0; i < 2; i++) {
      const a = await prisma.quizAttempt.create({ data: { quizId: q.quizId, userId: learners[i]!, status: "submitted", submittedAt: oct } });
      await prisma.feedbackDelivery.create({ data: { userId: learners[i]!, attemptId: a.id, body: "z", remediationLessonIds: [lesson2], deliveredAt: oct } });
    }

    const r = await getRemediationUptake(courseId, { range: "all" });
    expect(r).toEqual([
      { month: "2026-10", insufficient: true },
      { month: "2026-11", insufficient: false, deliveries: 10, clicked: 4, clickRatePct: 40 },
    ]);
  });
});

describe("không hồi quy — hoạt động học", () => {
  it("sự kiện report.* không tính là hoạt động học", async () => {
    const { isLearnerActivityType } = await import("../../learning/activity");
    expect(isLearnerActivityType(LearningEventType.ReportPublisherViewed)).toBe(false);
    expect(isLearnerActivityType(LearningEventType.ReportViewerGranted)).toBe(false);
  });
});

describe("Platform Admin", () => {
  it("xem được mọi khoá thuộc tổ chức", async () => {
    const owner = await makeUser("owner");
    const admin = await makeUser("admin");
    await grantRole(admin, { targetUserId: admin, roleName: "admin" });
    const org = await makeOrg();
    const { courseId } = await makeCourse(owner, { organizationId: org.id });
    expect(await canViewCourseReport(admin, courseId)).toBe(true);
    expect((await listReportCourses(admin)).map((c) => c.id)).toContain(courseId);
  });
});
