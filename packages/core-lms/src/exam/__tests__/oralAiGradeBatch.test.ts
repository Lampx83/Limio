import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { registerUser } from "../../auth/register";
import { deleteUser } from "../../auth/deleteUser";
import { createCourse } from "../../courses/courses";
import { enrollInCourse } from "../../learning/enroll";
import { isLearnerActivityType } from "../../learning/activity";
import { createExam, createOralMaterialTopicList, publishExam, startOralExamAttempt } from "../";
import { openForEnrolled } from "../../test/openForEnrolled";
import { fitTargetsToBudget } from "../../courses/aiGradeBatch";
import {
  applyOralAiSuggestions,
  estimateOralAiGradeTokens,
  finishOralAiGradeBatch,
  getOralAiGradeBatch,
  loadOralAiGradeBatchForRunner,
  planOralAiGradeBatch,
  recordOralAiGradeBatchProgress,
  requestStopOralAiGradeBatch,
  selectOralAiGradeTargets,
  startOralAiGradeBatch,
  type OralAiGradeCandidate,
} from "../oralAiGradeBatch";

const BASE = "http://localhost:3000";

function cand(over: Partial<OralAiGradeCandidate> & { attemptId: string }): OralAiGradeCandidate {
  return {
    status: "submitted",
    submittedAt: new Date("2026-11-01T00:00:00Z"),
    studentTurns: 3,
    transcriptChars: 3000,
    hasSuggestion: false,
    ...over,
  };
}

describe("selectOralAiGradeTargets — chọn lượt để AI đề xuất (AC3)", () => {
  it("không bao giờ chạy lượt đã chốt", () => {
    const r = selectOralAiGradeTargets([cand({ attemptId: "a", status: "graded" }), cand({ attemptId: "b" })], {});
    expect(r.targets.map((t) => t.attemptId)).toEqual(["b"]);
    expect(r.excluded).toContainEqual({ attemptId: "a", reason: "already_graded" });
  });

  it("bỏ lượt đã có đề xuất, trừ khi chọn chạy lại", () => {
    const rows = [cand({ attemptId: "has", hasSuggestion: true }), cand({ attemptId: "none" })];
    const r = selectOralAiGradeTargets(rows, {});
    expect(r.targets.map((t) => t.attemptId)).toEqual(["none"]);
    expect(r.excluded).toContainEqual({ attemptId: "has", reason: "has_suggestion" });
    expect(selectOralAiGradeTargets(rows, { includeExisting: true }).targets).toHaveLength(2);
  });

  it("lượt không có câu trả lời của sinh viên vào danh sách chưa gợi ý được", () => {
    const r = selectOralAiGradeTargets([cand({ attemptId: "e", studentTurns: 0 })], {});
    expect(r.targets).toHaveLength(0);
    expect(r.excluded).toContainEqual({ attemptId: "e", reason: "no_student_answer" });
  });

  it("sắp theo thứ tự nộp và nhận cả lượt tự đóng do hết giờ", () => {
    const rows = [
      cand({ attemptId: "late", submittedAt: new Date("2026-11-03T00:00:00Z") }),
      cand({ attemptId: "auto", status: "auto_submitted", submittedAt: new Date("2026-11-01T00:00:00Z") }),
      cand({ attemptId: "mid", submittedAt: new Date("2026-11-02T00:00:00Z") }),
    ];
    expect(selectOralAiGradeTargets(rows, {}).targets.map((t) => t.attemptId)).toEqual(["auto", "mid", "late"]);
  });
});

describe("estimate + fit — vừa ví (AC1)", () => {
  it("hội thoại dài tốn hơn, rubric cộng thêm, có trần", () => {
    expect(estimateOralAiGradeTokens(9000, 0)).toBeGreaterThan(estimateOralAiGradeTokens(900, 0));
    expect(estimateOralAiGradeTokens(900, 600)).toBeGreaterThan(estimateOralAiGradeTokens(900, 0));
    expect(estimateOralAiGradeTokens(10_000_000, 0)).toBe(30_000);
  });

  it("fitTargetsToBudget dùng được cho lượt vấn đáp: lấy phần đầu vừa số dư", () => {
    const t = [
      { attemptId: "a", estimatedTokens: 1000 },
      { attemptId: "b", estimatedTokens: 1000 },
      { attemptId: "c", estimatedTokens: 1000 },
    ];
    const { fit, overflow } = fitTargetsToBudget(t, 2500);
    expect(fit.map((x) => x.attemptId)).toEqual(["a", "b"]);
    expect(overflow).toBe(1);
  });
});

let seq = 0;
/** Đề vấn đáp có `n` sinh viên, mỗi người một lượt đã nộp (có câu trả lời, trừ lượt cuối nếu `last` = "silent"). */
async function setup(n: number, opts: { silentLast?: boolean } = {}) {
  const tag = `${Date.now()}-${++seq}-${Math.floor(Math.random() * 1e6)}`;
  const owner = await registerUser({ email: `oab-o-${tag}@e.com`, password: "password1234", displayName: "GV" }, BASE);
  const outsider = await registerUser({ email: `oab-x-${tag}@e.com`, password: "password1234", displayName: "X" }, BASE);
  const course = await createCourse(owner.userId, { title: `C ${tag}`, description: "x", slug: `oab-${tag}` });
  await prisma.course.update({ where: { id: course.courseId }, data: { status: "published", publishedAt: new Date() } });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Vấn đáp",
    durationMin: 20,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
    kind: "oral",
  });
  await createOralMaterialTopicList(owner.userId, examId, { title: "Chủ đề", text: "x" });
  await publishExam(owner.userId, examId);
  await openForEnrolled(owner.userId, examId);

  const learners: string[] = [];
  const attempts: string[] = [];
  for (let i = 0; i < n; i++) {
    const l = await registerUser({ email: `oab-l${i}-${tag}@e.com`, password: "password1234", displayName: `SV ${i}` }, BASE);
    await enrollInCourse(l.userId, course.courseId);
    const { attemptId } = await startOralExamAttempt(l.userId, examId);
    await prisma.examAttempt.update({
      where: { id: attemptId },
      data: { status: "submitted", submittedAt: new Date(now + i * 1000) },
    });
    const silent = opts.silentLast && i === n - 1;
    await prisma.oralExamTurn.deleteMany({ where: { attemptId } });
    await prisma.oralExamTurn.create({ data: { attemptId, role: "examiner", content: "Em hãy trình bày." } });
    if (!silent) await prisma.oralExamTurn.create({ data: { attemptId, role: "student", content: `Câu trả lời bí mật của SV ${i}` } });
    learners.push(l.userId);
    attempts.push(attemptId);
  }
  return { ownerId: owner.userId, outsiderId: outsider.userId, courseId: course.courseId, examId, learners, attempts };
}

describe("startOralAiGradeBatch — tạo và chạy lô (AC2, AC7)", () => {
  it("tạo lô cho các lượt chưa chốt và phát sự kiện không mang nội dung", async () => {
    const s = await setup(3);
    const r = await startOralAiGradeBatch(s.ownerId, s.examId, {});
    expect(r.total).toBe(3);
    const batch = await getOralAiGradeBatch(s.ownerId, s.examId);
    expect(batch).toMatchObject({ id: r.batchId, status: "running", total: 3, done: 0, failed: 0, skipped: 0 });

    const ev = await prisma.learningEvent.findMany({
      where: { eventType: LearningEventType.GradingOralBatchStarted, userId: s.ownerId },
    });
    expect(ev).toHaveLength(1);
    expect(ev[0]!.payload).toEqual({ examId: s.examId, batchId: r.batchId, total: 3 });
    expect(JSON.stringify(ev[0]!.payload)).not.toContain("bí mật");
    expect(isLearnerActivityType(LearningEventType.GradingOralBatchStarted)).toBe(false);
    expect(isLearnerActivityType(LearningEventType.GradingOralBatchCompleted)).toBe(false);
  });

  it("lượt không có lời sinh viên không vào lô", async () => {
    const s = await setup(3, { silentLast: true });
    const plan = await planOralAiGradeBatch(s.ownerId, s.examId, {});
    expect(plan.targets.map((t) => t.attemptId)).toEqual(s.attempts.slice(0, 2));
    expect(plan.excluded).toContainEqual({ attemptId: s.attempts[2], reason: "no_student_answer" });
  });

  it("người ngoài và sinh viên bị từ chối; đề không phải vấn đáp bị từ chối", async () => {
    const s = await setup(1);
    await expect(startOralAiGradeBatch(s.outsiderId, s.examId, {})).rejects.toMatchObject({ code: "forbidden" });
    await expect(getOralAiGradeBatch(s.learners[0]!, s.examId)).rejects.toMatchObject({ code: "forbidden" });
    const now = Date.now();
    const { examId: writtenId } = await createExam(s.ownerId, s.courseId, {
      title: "Viết",
      durationMin: 10,
      openAt: new Date(now - 60_000),
      closeAt: new Date(now + 60_000),
    });
    const written = { id: writtenId };
    await expect(planOralAiGradeBatch(s.ownerId, written.id, {})).rejects.toMatchObject({ code: "exam_not_oral" });
    await expect(planOralAiGradeBatch(s.ownerId, "khong-co", {})).rejects.toMatchObject({ code: "exam_not_found" });
  });

  it("đã có lô đang chạy thì từ chối lô thứ hai", async () => {
    const s = await setup(2);
    await startOralAiGradeBatch(s.ownerId, s.examId, {});
    await expect(startOralAiGradeBatch(s.ownerId, s.examId, {})).rejects.toMatchObject({ code: "batch_running" });
    expect(await prisma.oralAiGradeBatch.count({ where: { examId: s.examId, status: "running" } })).toBe(1);
  });

  it("lô chạy quá lâu (mất người chạy) được đóng để không chặn mãi", async () => {
    const s = await setup(2);
    const old = await startOralAiGradeBatch(s.ownerId, s.examId, {});
    await prisma.oralAiGradeBatch.update({ where: { id: old.batchId }, data: { startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000) } });
    const next = await startOralAiGradeBatch(s.ownerId, s.examId, {});
    expect(next.batchId).not.toBe(old.batchId);
    const closed = await prisma.oralAiGradeBatch.findUniqueOrThrow({ where: { id: old.batchId } });
    expect(closed).toMatchObject({ status: "halted", haltReason: "timeout" });
  });

  it("không còn lượt nào để chạy thì báo rõ; limit lấy phần đầu theo thứ tự nộp", async () => {
    const s = await setup(3);
    const r = await startOralAiGradeBatch(s.ownerId, s.examId, { limit: 2 });
    expect(r.total).toBe(2);
    expect((await loadOralAiGradeBatchForRunner(r.batchId))!.queue).toEqual(s.attempts.slice(0, 2));

    const e = await setup(1);
    await prisma.examAttempt.update({ where: { id: e.attempts[0]! }, data: { status: "graded" } });
    await expect(startOralAiGradeBatch(e.ownerId, e.examId, {})).rejects.toMatchObject({ code: "nothing_to_grade" });
  });

  it("tiến độ, dừng và kết thúc: cursor đúng, lỗi một lượt không dừng lô, sự kiện kết thúc chỉ phát một lần (AC2, AC6)", async () => {
    const s = await setup(3);
    const { batchId } = await startOralAiGradeBatch(s.ownerId, s.examId, {});
    await recordOralAiGradeBatchProgress(batchId, { kind: "done", attemptId: s.attempts[0]!, tokens: 1200 });
    await recordOralAiGradeBatchProgress(batchId, { kind: "failed", attemptId: s.attempts[1]!, code: "score_unreadable" });
    expect((await loadOralAiGradeBatchForRunner(batchId))!.cursor).toBe(2);

    expect((await requestStopOralAiGradeBatch(s.ownerId, s.examId)).stopped).toBe(true);
    await finishOralAiGradeBatch(batchId, { status: "stopped" });
    await finishOralAiGradeBatch(batchId, { status: "stopped" });

    const view = await getOralAiGradeBatch(s.ownerId, s.examId);
    expect(view).toMatchObject({ status: "stopped", done: 1, failed: 1, tokensUsed: 1200 });
    expect(view!.problems).toEqual([{ attemptId: s.attempts[1], code: "score_unreadable" }]);
    const ev = await prisma.learningEvent.findMany({ where: { eventType: LearningEventType.GradingOralBatchCompleted, userId: s.ownerId } });
    expect(ev).toHaveLength(1);
    expect(ev[0]!.payload).toMatchObject({ examId: s.examId, batchId, total: 3, done: 1, failed: 1, status: "stopped" });
  });

  it("dừng vì hết ví ghi lý do", async () => {
    const s = await setup(2);
    const { batchId } = await startOralAiGradeBatch(s.ownerId, s.examId, {});
    await finishOralAiGradeBatch(batchId, { status: "halted", haltReason: "no_token_budget" });
    expect(await getOralAiGradeBatch(s.ownerId, s.examId)).toMatchObject({ status: "halted", haltReason: "no_token_budget" });
    // Lô đã dừng thì chạy lại được.
    await expect(startOralAiGradeBatch(s.ownerId, s.examId, {})).resolves.toMatchObject({ total: 2 });
  });
});

describe("applyOralAiSuggestions — chốt theo đề xuất (AC4, AC5)", () => {
  it("chỉ lưu đề xuất thì điểm chốt, trạng thái, người chấm giữ nguyên", async () => {
    const s = await setup(1);
    await prisma.oralExamEvaluation.create({ data: { attemptId: s.attempts[0]!, aiSuggestedScore: 82, aiSummary: "Khá" } });
    const ev = await prisma.oralExamEvaluation.findUniqueOrThrow({ where: { attemptId: s.attempts[0]! } });
    expect(ev).toMatchObject({ instructorScore: null, gradedById: null, status: "pending_review" });
    const att = await prisma.examAttempt.findUniqueOrThrow({ where: { id: s.attempts[0]! } });
    expect(att.status).toBe("submitted");
  });

  it("chốt qua submitOralEvaluation: điểm đúng bằng AI nên approved, nhận xét AI thành ghi chú; bỏ lượt đã chốt / chưa có đề xuất", async () => {
    const s = await setup(3);
    const [a, b, c] = s.attempts as [string, string, string];
    await prisma.oralExamEvaluation.create({ data: { attemptId: a, aiSuggestedScore: 82.5, aiSummary: "Trả lời khá, thiếu ví dụ." } });
    await prisma.oralExamEvaluation.create({ data: { attemptId: b, aiSuggestedScore: 70, aiSummary: "x" } });
    await prisma.examAttempt.update({ where: { id: b }, data: { status: "graded" } });
    // c chưa có đề xuất.
    const r = await applyOralAiSuggestions(s.ownerId, s.examId, [a, b, c]);
    expect(r.applied).toEqual([a]);
    expect(r.skipped).toEqual(
      expect.arrayContaining([
        { attemptId: b, reason: "already_graded" },
        { attemptId: c, reason: "no_suggestion" },
      ]),
    );
    const ev = await prisma.oralExamEvaluation.findUniqueOrThrow({ where: { attemptId: a } });
    expect(ev).toMatchObject({ instructorScore: 82.5, status: "approved", gradedById: s.ownerId, instructorNotes: "Trả lời khá, thiếu ví dụ." });
    expect((await prisma.examAttempt.findUniqueOrThrow({ where: { id: a } })).status).toBe("graded");
    const graded = await prisma.learningEvent.findMany({ where: { eventType: LearningEventType.ExamOralEvaluationGraded, userId: s.ownerId } });
    expect(graded.length).toBeGreaterThanOrEqual(1);
  });

  it("người ngoài bị từ chối; lượt của đề khác không chốt được", async () => {
    const s = await setup(1);
    const other = await setup(1);
    await prisma.oralExamEvaluation.create({ data: { attemptId: other.attempts[0]!, aiSuggestedScore: 90 } });
    await expect(applyOralAiSuggestions(s.outsiderId, s.examId, s.attempts)).rejects.toMatchObject({ code: "forbidden" });
    const r = await applyOralAiSuggestions(s.ownerId, s.examId, [other.attempts[0]!]);
    expect(r.applied).toEqual([]);
    expect(r.skipped).toEqual([{ attemptId: other.attempts[0], reason: "no_suggestion" }]);
  });
});

describe("quyền riêng tư (AC7)", () => {
  it("xoá tài khoản xoá luôn các lô người đó bấm chạy; lô của người khác còn nguyên", async () => {
    const s = await setup(1);
    const other = await registerUser({ email: `oab-del-${Date.now()}@e.com`, password: "password1234", displayName: "GV2" }, BASE);
    const mk = (startedById: string) =>
      prisma.oralAiGradeBatch.create({ data: { examId: s.examId, startedById, queue: [], total: 0, status: "completed" } });
    const mine = await mk(s.ownerId);
    const theirs = await mk(other.userId);
    const admin = await registerUser({ email: `oab-admin-${Date.now()}@e.com`, password: "password1234", displayName: "Admin" }, BASE);
    await deleteUser(admin.userId, other.userId);
    expect(await prisma.oralAiGradeBatch.count({ where: { id: theirs.id } })).toBe(0);
    expect(await prisma.oralAiGradeBatch.count({ where: { id: mine.id } })).toBe(1);
  });
});
