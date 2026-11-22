import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { createAssignment, gradeSubmission, submitAssignment } from "../assignments";
import {
  applyAiGradeSuggestions,
  estimateAiGradeTokens,
  finishAiGradeBatch,
  fitTargetsToBudget,
  getAiGradeBatch,
  listAiGradeSuggestions,
  loadAiGradeBatchForRunner,
  recordAiGradeBatchProgress,
  requestStopAiGradeBatch,
  saveAiGradeSuggestion,
  selectAiGradeTargets,
  startAiGradeBatch,
  type AiGradeCandidate,
} from "../aiGradeBatch";
import { registerUser } from "../../auth/register";
import { createCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { enrollInCourse } from "../../learning/enroll";
import { isLearnerActivityType } from "../../learning/activity";

const BASE = "http://localhost:3000";

function cand(over: Partial<AiGradeCandidate> & { submissionId: string }): AiGradeCandidate {
  return {
    userId: `u-${over.submissionId}`,
    status: "submitted",
    submittedAt: new Date("2026-11-01T00:00:00Z"),
    updatedAt: new Date("2026-11-01T00:00:00Z"),
    body: "Bài làm của học viên về chủ đề này.",
    attachmentUrl: null,
    teamId: null,
    teamSubmittedAt: null,
    suggestionBasedOn: null,
    ...over,
  };
}

describe("selectAiGradeTargets — chọn bài để AI gợi ý (AC3)", () => {
  it("không bao giờ chạy bài đã chấm", () => {
    const r = selectAiGradeTargets([cand({ submissionId: "a", status: "graded" }), cand({ submissionId: "b" })], {});
    expect(r.targets.map((t) => t.submissionId)).toEqual(["b"]);
    expect(r.excluded).toContainEqual({ submissionId: "a", reason: "already_graded" });
  });

  it("bỏ bài có gợi ý còn mới, chạy lại bài đã đổi sau gợi ý", () => {
    const rows = [
      cand({ submissionId: "fresh", updatedAt: new Date("2026-11-02T00:00:00Z"), suggestionBasedOn: new Date("2026-11-02T00:00:00Z") }),
      cand({ submissionId: "stale", updatedAt: new Date("2026-11-03T00:00:00Z"), suggestionBasedOn: new Date("2026-11-02T00:00:00Z") }),
      cand({ submissionId: "none" }),
    ];
    const r = selectAiGradeTargets(rows, {});
    expect(r.targets.map((t) => t.submissionId).sort()).toEqual(["none", "stale"]);
    expect(r.excluded).toContainEqual({ submissionId: "fresh", reason: "has_suggestion" });
  });

  it("includeFresh chạy lại cả bài đã có gợi ý mới", () => {
    const rows = [cand({ submissionId: "fresh", suggestionBasedOn: new Date("2026-11-01T00:00:00Z") })];
    expect(selectAiGradeTargets(rows, { includeFresh: true }).targets).toHaveLength(1);
  });

  it("bài trống (không chữ, không tệp) vào danh sách chưa gợi ý được", () => {
    const r = selectAiGradeTargets([cand({ submissionId: "e", body: "   " })], {});
    expect(r.targets).toHaveLength(0);
    expect(r.excluded).toContainEqual({ submissionId: "e", reason: "empty_submission" });
  });

  it("chỉ có tệp đính kèm thì vẫn chạy (AI tự báo nếu không đọc được)", () => {
    const r = selectAiGradeTargets([cand({ submissionId: "f", body: "", attachmentUrl: "/api/x/file.pdf" })], {});
    expect(r.targets).toHaveLength(1);
  });

  it("nộp nhóm: một lần cho mỗi nhóm, lấy lần nộp mới nhất", () => {
    const old = new Date("2026-11-01T00:00:00Z");
    const recent = new Date("2026-11-05T00:00:00Z");
    const rows = [
      cand({ submissionId: "t1-a", teamId: "T1", teamSubmittedAt: recent }),
      cand({ submissionId: "t1-b", teamId: "T1", teamSubmittedAt: recent }),
      cand({ submissionId: "t1-old", teamId: "T1", teamSubmittedAt: old }),
      cand({ submissionId: "t2-a", teamId: "T2", teamSubmittedAt: old }),
      cand({ submissionId: "solo" }),
    ];
    const r = selectAiGradeTargets(rows, {});
    const ids = r.targets.map((t) => t.submissionId);
    expect(ids.filter((i) => i.startsWith("t1"))).toHaveLength(1);
    expect(ids).toContain("t2-a");
    expect(ids).toContain("solo");
    expect(r.targets).toHaveLength(3);
    expect(r.excluded.filter((e) => e.reason === "team_duplicate")).toHaveLength(2);
  });

  it("sắp theo thứ tự nộp", () => {
    const rows = [
      cand({ submissionId: "late", submittedAt: new Date("2026-11-03T00:00:00Z") }),
      cand({ submissionId: "early", submittedAt: new Date("2026-11-01T00:00:00Z") }),
    ];
    expect(selectAiGradeTargets(rows, {}).targets.map((t) => t.submissionId)).toEqual(["early", "late"]);
  });
});

describe("estimate + fit — vừa ví (AC1)", () => {
  it("bài dài tốn hơn bài ngắn, có trần", () => {
    const short = estimateAiGradeTokens({ body: "một hai ba", attachmentUrl: null });
    const long = estimateAiGradeTokens({ body: "từ ".repeat(2000), attachmentUrl: null });
    const huge = estimateAiGradeTokens({ body: "từ ".repeat(200000), attachmentUrl: null });
    expect(long).toBeGreaterThan(short);
    expect(huge).toBeLessThanOrEqual(estimateAiGradeTokens({ body: "từ ".repeat(400000), attachmentUrl: null }));
    expect(huge).toBeLessThan(40_000);
  });

  it("có tệp đính kèm thì cộng phần dự phòng", () => {
    const a = estimateAiGradeTokens({ body: "x", attachmentUrl: null });
    const b = estimateAiGradeTokens({ body: "x", attachmentUrl: "/f.pdf" });
    expect(b).toBeGreaterThan(a);
  });

  it("fitTargetsToBudget lấy phần đầu vừa số dư, không chạy rồi dừng giữa chừng", () => {
    const t = [
      { submissionId: "1", estimatedTokens: 1000 },
      { submissionId: "2", estimatedTokens: 1000 },
      { submissionId: "3", estimatedTokens: 1000 },
    ];
    const r = fitTargetsToBudget(t, 2500);
    expect(r.fit.map((x) => x.submissionId)).toEqual(["1", "2"]);
    expect(r.overflow).toBe(1);
    expect(fitTargetsToBudget(t, 10_000).overflow).toBe(0);
    expect(fitTargetsToBudget(t, 0).fit).toHaveLength(0);
  });
});

async function setup(learnerCount = 3) {
  const inst = await registerUser(
    { email: `inst-${Date.now()}-${Math.random()}@e.com`, password: "password1234", displayName: "Inst" },
    BASE,
  );
  const outsider = await registerUser(
    { email: `out-${Date.now()}-${Math.random()}@e.com`, password: "password1234", displayName: "Out" },
    BASE,
  );
  const c = await createCourse(inst.userId, { title: "AI batch", description: "x" });
  const m = await createModule(inst.userId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(inst.userId, m.moduleId, { title: "L", orderIndex: 0 });
  await prisma.course.update({ where: { id: c.courseId }, data: { status: "published" } });
  const a = await createAssignment(inst.userId, l.lessonId, { title: "T", description: "Viết đoạn văn", maxScore: 10 });
  const learners: string[] = [];
  const subs: string[] = [];
  for (let i = 0; i < learnerCount; i++) {
    const lr = await registerUser(
      { email: `lr${i}-${Date.now()}-${Math.random()}@e.com`, password: "password1234", displayName: `Lr${i}` },
      BASE,
    );
    await enrollInCourse(lr.userId, c.courseId);
    const s = await submitAssignment(lr.userId, a.assignmentId, { body: `Bài số ${i} của học viên.` });
    learners.push(lr.userId);
    subs.push(s.submissionId);
  }
  return { instId: inst.userId, outsiderId: outsider.userId, courseId: c.courseId, assignmentId: a.assignmentId, learners, subs };
}

const SUGGESTION = (updatedAt: Date, score = 7) => ({
  score,
  feedback: "Bài đủ ý, cần thêm ví dụ.",
  rationale: "Đáp ứng yêu cầu chính.",
  criteria: [{ name: "Nội dung", maxPoints: 10, points: score }],
  hadRubric: false,
  readSources: [] as string[],
  unread: null,
  truncated: null,
  tokensUsed: 900,
  basedOnSubmissionUpdatedAt: updatedAt,
});

describe("startAiGradeBatch — tạo và chạy lô (AC2, AC7)", () => {
  it("tạo lô cho các bài chưa chấm và phát sự kiện không mang nội dung", async () => {
    const s = await setup(3);
    const r = await startAiGradeBatch(s.instId, s.assignmentId, {});
    expect(r.total).toBe(3);
    const batch = await getAiGradeBatch(s.instId, s.assignmentId);
    expect(batch).toMatchObject({ id: r.batchId, status: "running", total: 3, done: 0, failed: 0, skipped: 0 });

    const ev = await prisma.learningEvent.findMany({ where: { eventType: LearningEventType.GradingAiBatchStarted, userId: s.instId } });
    expect(ev).toHaveLength(1);
    expect(ev[0]!.payload).toEqual({ assignmentId: s.assignmentId, batchId: r.batchId, total: 3 });
    expect(JSON.stringify(ev[0]!.payload)).not.toContain("Bài số");
    expect(isLearnerActivityType(LearningEventType.GradingAiBatchStarted)).toBe(false);
  });

  it("người ngoài khoá bị từ chối", async () => {
    const s = await setup(1);
    await expect(startAiGradeBatch(s.outsiderId, s.assignmentId, {})).rejects.toMatchObject({ code: "forbidden" });
    await expect(getAiGradeBatch(s.learners[0]!, s.assignmentId)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("đã có lô đang chạy thì từ chối lô thứ hai", async () => {
    const s = await setup(2);
    await startAiGradeBatch(s.instId, s.assignmentId, {});
    await expect(startAiGradeBatch(s.instId, s.assignmentId, {})).rejects.toMatchObject({ code: "batch_running" });
    const running = await prisma.assignmentAiGradeBatch.count({ where: { assignmentId: s.assignmentId, status: "running" } });
    expect(running).toBe(1);
  });

  it("lô chạy quá lâu (mất người chạy) được đóng để không chặn mãi", async () => {
    const s = await setup(2);
    const old = await startAiGradeBatch(s.instId, s.assignmentId, {});
    await prisma.assignmentAiGradeBatch.update({
      where: { id: old.batchId },
      data: { startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
    });
    const next = await startAiGradeBatch(s.instId, s.assignmentId, {});
    expect(next.batchId).not.toBe(old.batchId);
    const closed = await prisma.assignmentAiGradeBatch.findUniqueOrThrow({ where: { id: old.batchId } });
    expect(closed).toMatchObject({ status: "halted", haltReason: "timeout" });
  });

  it("không còn bài nào để chạy thì báo rõ", async () => {
    const s = await setup(1);
    await gradeSubmission(s.instId, s.subs[0]!, { score: 5 });
    await expect(startAiGradeBatch(s.instId, s.assignmentId, {})).rejects.toMatchObject({ code: "nothing_to_grade" });
  });

  it("limit lấy phần đầu theo thứ tự nộp", async () => {
    const s = await setup(3);
    const r = await startAiGradeBatch(s.instId, s.assignmentId, { limit: 2 });
    expect(r.total).toBe(2);
    const runner = await loadAiGradeBatchForRunner(r.batchId);
    expect(runner!.queue).toEqual(s.subs.slice(0, 2));
  });

  it("tiến độ, dừng và kết thúc; lỗi một bài không dừng cả lô (AC2, AC6)", async () => {
    const s = await setup(3);
    const { batchId } = await startAiGradeBatch(s.instId, s.assignmentId, {});
    await recordAiGradeBatchProgress(batchId, { kind: "done", submissionId: s.subs[0]!, tokens: 900 });
    await recordAiGradeBatchProgress(batchId, { kind: "failed", submissionId: s.subs[1]!, code: "openai_error" });

    let runner = await loadAiGradeBatchForRunner(batchId);
    expect(runner).toMatchObject({ cursor: 2, stopRequested: false, status: "running" });

    await requestStopAiGradeBatch(s.instId, s.assignmentId);
    runner = await loadAiGradeBatchForRunner(batchId);
    expect(runner!.stopRequested).toBe(true);

    await finishAiGradeBatch(batchId, { status: "stopped" });
    const batch = await getAiGradeBatch(s.instId, s.assignmentId);
    expect(batch).toMatchObject({ status: "stopped", done: 1, failed: 1, tokensUsed: 900 });
    expect(batch!.problems).toEqual([{ submissionId: s.subs[1]!, code: "openai_error" }]);

    const ev = await prisma.learningEvent.findMany({ where: { eventType: LearningEventType.GradingAiBatchCompleted, userId: s.instId } });
    expect(ev).toHaveLength(1);
    expect(ev[0]!.payload).toMatchObject({ assignmentId: s.assignmentId, batchId, total: 3, done: 1, failed: 1, status: "stopped" });

    // Kết thúc hai lần không phát hai sự kiện; sau đó chạy lô mới được.
    await finishAiGradeBatch(batchId, { status: "stopped" });
    expect(await prisma.learningEvent.count({ where: { eventType: LearningEventType.GradingAiBatchCompleted, userId: s.instId } })).toBe(1);
    await expect(startAiGradeBatch(s.instId, s.assignmentId, {})).resolves.toBeTruthy();
  });

  it("dừng vì hết ví ghi lý do, giữ gợi ý đã có (AC6)", async () => {
    const s = await setup(2);
    const { batchId } = await startAiGradeBatch(s.instId, s.assignmentId, {});
    const sub = await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: s.subs[0]! } });
    await saveAiGradeSuggestion(s.subs[0]!, s.assignmentId, batchId, SUGGESTION(sub.updatedAt));
    await recordAiGradeBatchProgress(batchId, { kind: "done", submissionId: s.subs[0]!, tokens: 900 });
    await finishAiGradeBatch(batchId, { status: "halted", haltReason: "no_token_budget" });
    const batch = await getAiGradeBatch(s.instId, s.assignmentId);
    expect(batch).toMatchObject({ status: "halted", haltReason: "no_token_budget", done: 1 });
    expect(await prisma.assignmentAiGradeSuggestion.count({ where: { assignmentId: s.assignmentId } })).toBe(1);
    // Chạy tiếp: bài đã có gợi ý mới không chạy lại.
    const next = await startAiGradeBatch(s.instId, s.assignmentId, {});
    expect(next.total).toBe(1);
  });
});

describe("gợi ý chỉ là gợi ý (AC4)", () => {
  it("lưu gợi ý không đổi điểm, trạng thái, người chấm", async () => {
    const s = await setup(1);
    const before = await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: s.subs[0]! } });
    await saveAiGradeSuggestion(s.subs[0]!, s.assignmentId, null, SUGGESTION(before.updatedAt));
    const after = await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: s.subs[0]! } });
    expect(after).toMatchObject({ status: "submitted", score: null, feedback: null, graderId: null, gradedAt: null });
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  it("danh sách cho giảng viên: fresh rồi stale khi học viên nộp lại; người ngoài bị từ chối", async () => {
    const s = await setup(1);
    const sub = await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: s.subs[0]! } });
    await saveAiGradeSuggestion(s.subs[0]!, s.assignmentId, null, SUGGESTION(sub.updatedAt, 8));
    let list = await listAiGradeSuggestions(s.instId, s.assignmentId);
    expect(list[s.subs[0]!]).toMatchObject({ score: 8, state: "fresh" });

    await new Promise((r) => setTimeout(r, 20));
    await submitAssignment(s.learners[0]!, s.assignmentId, { body: "Bản sửa." });
    list = await listAiGradeSuggestions(s.instId, s.assignmentId);
    expect(list[s.subs[0]!]).toMatchObject({ state: "stale" });

    await expect(listAiGradeSuggestions(s.outsiderId, s.assignmentId)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("applyAiGradeSuggestions — chốt theo gợi ý (AC5)", () => {
  it("chốt qua gradeSubmission, bỏ bài đã chấm / gợi ý cũ / chưa có gợi ý", async () => {
    const s = await setup(4);
    const subs = await prisma.assignmentSubmission.findMany({ where: { assignmentId: s.assignmentId }, orderBy: { submittedAt: "asc" } });
    const [fresh, stale, graded, none] = [subs[0]!, subs[1]!, subs[2]!, subs[3]!];
    await saveAiGradeSuggestion(fresh.id, s.assignmentId, null, SUGGESTION(fresh.updatedAt, 7));
    await saveAiGradeSuggestion(stale.id, s.assignmentId, null, SUGGESTION(new Date(stale.updatedAt.getTime() - 1000), 6));
    await saveAiGradeSuggestion(graded.id, s.assignmentId, null, SUGGESTION(graded.updatedAt, 9));
    await gradeSubmission(s.instId, graded.id, { score: 3, feedback: "Thầy chấm" });

    const r = await applyAiGradeSuggestions(s.instId, s.assignmentId, [fresh.id, stale.id, graded.id, none.id]);
    expect(r.applied).toEqual([fresh.id]);
    expect(r.skipped).toEqual(
      expect.arrayContaining([
        { submissionId: stale.id, reason: "stale" },
        { submissionId: graded.id, reason: "already_graded" },
        { submissionId: none.id, reason: "no_suggestion" },
      ]),
    );

    const a = await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: fresh.id } });
    expect(a).toMatchObject({ status: "graded", score: 7, feedback: "Bài đủ ý, cần thêm ví dụ.", graderId: s.instId });
    // Điểm thầy đã chốt không bị đổi.
    const g = await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: graded.id } });
    expect(g).toMatchObject({ score: 3, feedback: "Thầy chấm" });
    const n = await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: none.id } });
    expect(n.status).toBe("submitted");
  });

  it("điểm gợi ý vượt thang bị chặn, người ngoài bị từ chối", async () => {
    const s = await setup(1);
    const sub = await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: s.subs[0]! } });
    await saveAiGradeSuggestion(sub.id, s.assignmentId, null, SUGGESTION(sub.updatedAt, 99));
    const r = await applyAiGradeSuggestions(s.instId, s.assignmentId, [sub.id]);
    expect(r.applied).toEqual([]);
    expect(r.skipped).toEqual([{ submissionId: sub.id, reason: "score_exceeds_max" }]);
    await expect(applyAiGradeSuggestions(s.outsiderId, s.assignmentId, [sub.id])).rejects.toMatchObject({ code: "forbidden" });
  });
});
