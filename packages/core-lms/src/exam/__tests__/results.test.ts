import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { enrollInCourse } from "../../learning/enroll";
import {
  createExam,
  createExamQuestion,
  listExamResults,
  publishExam,
  saveAnswer,
  startExamAttempt,
  submitExamAttempt,
} from "../";

const BASE = "http://localhost:3000";

const mcq = () => ({
  options: [
    { id: "a", label: "A", isCorrect: true },
    { id: "b", label: "B", isCorrect: false },
  ],
});

async function setup(slug: string, opts: { essay?: boolean } = {}) {
  const owner = await registerUser(
    { email: `res-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `res-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: `Đề ${slug}`,
    durationMin: 60,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 86_400_000),
    passScore: 50,
  });
  const q1 = await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "Q1",
    config: mcq(),
    points: 10,
  });
  const q2 = opts.essay
    ? await createExamQuestion(owner.userId, examId, {
        type: "essay",
        prompt: "Tự luận",
        config: { rubric: "x" },
        points: 10,
      })
    : null;
  await publishExam(owner.userId, examId);
  return {
    ownerId: owner.userId,
    courseId: course.courseId,
    examId,
    q1: q1.questionId,
    q2: q2?.questionId ?? null,
    slug,
  };
}

async function learnerTakes(
  s: Awaited<ReturnType<typeof setup>>,
  i: number,
  pick: "a" | "b",
  opts: { submit?: boolean; essayText?: string } = {},
) {
  const u = await registerUser(
    {
      email: `res-l-${s.slug}-${i}@e.com`,
      password: "password1234",
      displayName: `Học viên ${i}`,
    },
    BASE,
  );
  await enrollInCourse(u.userId, s.courseId);
  const start = await startExamAttempt(u.userId, s.examId);
  await saveAnswer({ kind: "user", userId: u.userId }, start.attemptId, s.q1, {
    answerJson: { optionIds: [pick] },
    sessionToken: start.sessionToken,
  });
  if (s.q2 && opts.essayText) {
    await saveAnswer({ kind: "user", userId: u.userId }, start.attemptId, s.q2, {
      answerJson: { text: opts.essayText },
      sessionToken: start.sessionToken,
    });
  }
  if (opts.submit !== false) {
    await submitExamAttempt({ kind: "user", userId: u.userId }, start.attemptId);
  }
  return u.userId;
}

/** Học viên ghi danh nhưng không làm bài. */
async function enrollOnly(s: Awaited<ReturnType<typeof setup>>, i: number) {
  const u = await registerUser(
    {
      email: `res-n-${s.slug}-${i}@e.com`,
      password: "password1234",
      displayName: `Chưa làm ${i}`,
    },
    BASE,
  );
  await enrollInCourse(u.userId, s.courseId);
  return u.userId;
}

describe("listExamResults", () => {
  it("gom mọi lượt làm mà không cần đi qua đợt hay ca", async () => {
    const s = await setup("basic");
    await learnerTakes(s, 1, "a");
    await learnerTakes(s, 2, "b");

    const r = await listExamResults(s.ownerId, s.examId);
    expect(r.rows.filter((x) => x.attemptId !== null)).toHaveLength(2);
    expect(r.summary.submitted).toBe(2);
    expect(r.totalPoints).toBe(10);
  });

  it("liệt kê học viên đã ghi danh nhưng chưa làm", async () => {
    const s = await setup("notstarted");
    await learnerTakes(s, 1, "a");
    await enrollOnly(s, 2);
    await enrollOnly(s, 3);

    const r = await listExamResults(s.ownerId, s.examId);
    expect(r.summary.notStarted).toBe(2);
    const missing = r.rows.filter((x) => x.status === "not_started");
    expect(missing).toHaveLength(2);
    expect(missing[0]!.score).toBeNull();
    expect(missing[0]!.attemptId).toBeNull();
  });

  it("tính điểm trung bình và số đạt", async () => {
    const s = await setup("avg");
    await learnerTakes(s, 1, "a"); // 100%
    await learnerTakes(s, 2, "a"); // 100%
    await learnerTakes(s, 3, "b"); // 0%

    const r = await listExamResults(s.ownerId, s.examId);
    expect(r.summary.avgScorePct).toBeCloseTo((100 + 100 + 0) / 3, 5);
    expect(r.summary.passedCount).toBe(2);
  });

  it("đếm bài còn chờ chấm tay", async () => {
    const s = await setup("pending", { essay: true });
    await learnerTakes(s, 1, "a", { essayText: "bài viết" });

    const r = await listExamResults(s.ownerId, s.examId);
    expect(r.summary.pendingGrading).toBe(1);
    expect(r.rows.find((x) => x.attemptId)!.needsGrading).toBe(true);
  });

  it("bài đang làm dở không tính là đã nộp", async () => {
    const s = await setup("inprogress");
    await learnerTakes(s, 1, "a", { submit: false });

    const r = await listExamResults(s.ownerId, s.examId);
    expect(r.summary.inProgress).toBe(1);
    expect(r.summary.submitted).toBe(0);
  });

  it("từ chối người không có quyền sửa khoá học", async () => {
    const s = await setup("authz");
    const stranger = await registerUser(
      { email: `res-x-${s.slug}@e.com`, password: "password1234", displayName: "X" },
      BASE,
    );
    await expect(
      listExamResults(stranger.userId, s.examId),
    ).rejects.toBeTruthy();
  });

  it("đề một ca — giao diện sẽ không hiện bộ lọc", async () => {
    const s = await setup("filters");
    await learnerTakes(s, 1, "a");

    const r = await listExamResults(s.ownerId, s.examId);
    // publishExam dựng sẵn đúng MỘT ca mặc định. Bộ lọc chỉ hiện khi có nhiều
    // hơn một — đó là quyết định ở tầng giao diện.
    expect(r.sessions).toHaveLength(1);
  });

  it("lọc theo ca chỉ giữ lượt làm thuộc ca đó", async () => {
    const s = await setup("byses");
    await learnerTakes(s, 1, "a");

    // Lọc theo một ca không tồn tại → không lượt nào khớp, và cũng không kéo
    // theo cột "chưa làm" (không có danh sách gốc trong phạm vi một ca).
    const r = await listExamResults(s.ownerId, s.examId, {
      sessionId: "00000000-0000-0000-0000-000000000000",
    });
    expect(r.rows).toHaveLength(0);
    expect(r.summary.notStarted).toBe(0);
  });
});
