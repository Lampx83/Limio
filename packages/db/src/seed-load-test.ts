/**
 * Seed dữ liệu cho load test 5000 SV thi đồng thời (Tintin).
 *
 * Tạo:
 *   - 1 ExamRound + 1 ExamSession (open_code mode, openCode="LOAD01")
 *   - 1 Exam có 30 câu MCQ
 *   - N ExamCandidate (default 5000)
 *   - N ExamAttempt status=in_progress, startedAt=now, durationSec=3600 (1h)
 *   - Xuất file `attempts.json` chứa { attemptId, sessionToken, questionIds }
 *     để `load-test/exam.k6.js` đọc qua biến môi trường ATTEMPTS_JSON.
 *
 * Idempotent: reuse exam/round/session theo title nếu đã tồn tại; chỉ tạo
 * thêm candidate/attempt cho đủ N.
 *
 * CẢNH BÁO: KHÔNG chạy lên prod 224 — đây là dữ liệu test, sẽ tạo 5000
 * row giả. Chạy trên staging mirror hoặc local DB.
 *
 * Chạy:
 *   pnpm --filter @feedbackme/db tsx src/seed-load-test.ts
 *
 * Override:
 *   COUNT=10000 OUTPUT=./attempts.json \
 *     pnpm --filter @feedbackme/db tsx src/seed-load-test.ts
 *
 * Dọn dữ liệu sau test:
 *   pnpm --filter @feedbackme/db tsx src/seed-load-test.ts --cleanup
 */
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "./generated/client";

const prisma = new PrismaClient();

const EXAM_TITLE = "[LOADTEST] Tintin 5K concurrency";
const ROUND_CODE = "LOADTEST-TINTIN";
const SESSION_CODE = "LOADTEST-S1";
const OPEN_CODE = "LOAD01";
const QUESTION_COUNT = 30;
const DURATION_SEC = 3600;

async function findOrCreateCourse(): Promise<{ id: string; ownerUserId: string }> {
  const instructor = await prisma.user.findFirst({
    where: { email: "alice@feedbackme.dev" },
  });
  if (!instructor) {
    throw new Error(
      "Cần chạy seed-demo-users.ts trước (cần user alice@feedbackme.dev làm instructor)",
    );
  }
  // Reuse course "dai-so-co-ban" nếu có (seed-sample-course.ts đã chạy), nếu không
  // tạo course tối thiểu mới.
  const existing = await prisma.course.findFirst({
    where: { slug: "dai-so-co-ban" },
    select: { id: true },
  });
  if (existing) return { id: existing.id, ownerUserId: instructor.id };

  const c = await prisma.course.create({
    data: {
      slug: "loadtest-course",
      title: "[LOADTEST] Course",
      description: "Tự sinh cho load test.",
    },
    select: { id: true },
  });
  return { id: c.id, ownerUserId: instructor.id };
}

async function ensureExamSetup(courseId: string, ownerUserId: string) {
  let exam = await prisma.exam.findFirst({
    where: { courseId, title: EXAM_TITLE },
  });
  if (!exam) {
    console.log("Tạo exam mới…");
    const now = new Date();
    exam = await prisma.exam.create({
      data: {
        courseId,
        title: EXAM_TITLE,
        description: "Tự sinh cho load test — không phải đề thi thật.",
        durationMin: Math.floor(DURATION_SEC / 60),
        openAt: new Date(now.getTime() - 60_000),
        closeAt: new Date(now.getTime() + 365 * 24 * 60 * 60_000),
        accessMode: "open_code",
        openCode: OPEN_CODE,
        publishedAt: now,
      },
    });
  }

  // ExamQuestion — tạo 30 câu MCQ nếu thiếu.
  const existingQs = await prisma.examQuestion.count({ where: { examId: exam.id } });
  if (existingQs < QUESTION_COUNT) {
    console.log(`Tạo ${QUESTION_COUNT - existingQs} câu MCQ…`);
    const data = [];
    for (let i = existingQs; i < QUESTION_COUNT; i++) {
      data.push({
        examId: exam.id,
        type: "mcq" as const,
        prompt: `[LOADTEST] Câu ${i + 1}: 2 + ${i} = ?`,
        config: {
          options: [
            { id: "a", label: String(i + 2), isCorrect: true },
            { id: "b", label: String(i + 3), isCorrect: false },
            { id: "c", label: String(i + 4), isCorrect: false },
            { id: "d", label: String(i + 5), isCorrect: false },
          ],
        },
        points: 1,
        orderInExam: i,
      });
    }
    await prisma.examQuestion.createMany({ data });
  }

  // ExamRound — idempotent theo (courseId, code).
  let round = await prisma.examRound.findFirst({
    where: { courseId, code: ROUND_CODE },
  });
  if (!round) {
    const now = new Date();
    round = await prisma.examRound.create({
      data: {
        courseId,
        code: ROUND_CODE,
        title: "[LOADTEST] Round Tintin",
        opensAt: new Date(now.getTime() - 60_000),
        closesAt: new Date(now.getTime() + 365 * 24 * 60 * 60_000),
        status: "open",
      },
    });
    // Cấp quyền admin round cho instructor owner.
    await prisma.examRoundAdmin.upsert({
      where: { roundId_userId: { roundId: round.id, userId: ownerUserId } },
      update: {},
      create: { roundId: round.id, userId: ownerUserId, grantedBy: ownerUserId },
    });
  }

  // ExamSession — open_code với mã shared.
  let session = await prisma.examSession.findFirst({
    where: { examId: exam.id, code: SESSION_CODE },
  });
  if (!session) {
    const now = new Date();
    session = await prisma.examSession.create({
      data: {
        examId: exam.id,
        roundId: round.id,
        code: SESSION_CODE,
        title: "[LOADTEST] Session 1",
        status: "open",
        accessMode: "open_code",
        openCode: OPEN_CODE,
        opensAt: new Date(now.getTime() - 60_000),
        closesAt: new Date(now.getTime() + 365 * 24 * 60 * 60_000),
      },
    });
  }

  const questions = await prisma.examQuestion.findMany({
    where: { examId: exam.id },
    select: { id: true },
    orderBy: { orderInExam: "asc" },
  });

  return {
    examId: exam.id,
    sessionId: session.id,
    questionIds: questions.map((q) => q.id),
  };
}

async function seedAttempts(
  examId: string,
  sessionId: string,
  count: number,
): Promise<Array<{ attemptId: string; sessionToken: string }>> {
  // Kiểm tra số candidate hiện có trên session — chỉ tạo bù thêm.
  const existingCount = await prisma.examCandidate.count({
    where: { sessionId },
  });
  const toCreate = Math.max(0, count - existingCount);
  console.log(`Hiện có ${existingCount} candidate; cần tạo thêm ${toCreate}.`);

  if (toCreate > 0) {
    // Tạo candidates theo chunk 1000 (createMany có giới hạn).
    const CHUNK = 1000;
    for (let i = 0; i < toCreate; i += CHUNK) {
      const slice = Math.min(CHUNK, toCreate - i);
      const candidates = [];
      for (let j = 0; j < slice; j++) {
        const idx = existingCount + i + j;
        candidates.push({
          examId,
          sessionId,
          displayName: `LoadTest SV ${idx + 1}`,
          metadata: { loadTest: true, index: idx } as object,
        });
      }
      await prisma.examCandidate.createMany({ data: candidates });
      console.log(`Đã tạo candidate ${i + slice}/${toCreate}`);
    }
  }

  // Lấy danh sách candidate (gồm cả cũ + mới) chưa có attempt.
  const candidates = await prisma.examCandidate.findMany({
    where: {
      sessionId,
      attempts: { none: {} },
    },
    select: { id: true },
    take: count,
  });
  console.log(`${candidates.length} candidate chưa có attempt → tạo attempt.`);

  // Tạo attempts theo chunk. createMany không trả về id nên cần generate sẵn UUID
  // và lưu mapping để xuất ra file.
  const now = new Date();
  const CHUNK = 500;
  const out: Array<{ attemptId: string; sessionToken: string }> = [];
  for (let i = 0; i < candidates.length; i += CHUNK) {
    const slice = candidates.slice(i, i + CHUNK);
    const data = slice.map((c) => {
      const attemptId = randomUUID();
      const sessionToken = randomUUID();
      out.push({ attemptId, sessionToken });
      return {
        id: attemptId,
        examId,
        candidateId: c.id,
        candidateDisplayName: `LoadTest SV`,
        status: "in_progress" as const,
        startedAt: now,
        durationSec: DURATION_SEC,
        sessionToken,
      };
    });
    await prisma.examAttempt.createMany({ data });
    console.log(`Đã tạo attempt ${Math.min(i + CHUNK, candidates.length)}/${candidates.length}`);
  }

  // Lấy thêm attempt đã tồn tại để có đủ `count` rows trong output.
  if (out.length < count) {
    const existing = await prisma.examAttempt.findMany({
      where: {
        examId,
        candidate: { sessionId },
      },
      select: { id: true, sessionToken: true },
      take: count - out.length,
    });
    for (const a of existing) {
      out.push({ attemptId: a.id, sessionToken: a.sessionToken });
      if (out.length >= count) break;
    }
  }

  return out.slice(0, count);
}

async function cleanup() {
  console.log("Dọn dữ liệu load test…");
  // Xóa exam → cascade attempts/candidates/questions/sessions. Round không cascade.
  const exam = await prisma.exam.findFirst({ where: { title: EXAM_TITLE } });
  if (exam) {
    await prisma.exam.delete({ where: { id: exam.id } });
    console.log("Đã xóa exam (cascade attempts/candidates/questions).");
  }
  // ExamRound + ExamSession không tự cascade khi exam xóa (round độc lập với exam).
  // Session sẽ bị cascade qua exam.id (relation cascade). Round vẫn còn.
  const round = await prisma.examRound.findFirst({ where: { code: ROUND_CODE } });
  if (round) {
    await prisma.examRound.delete({ where: { id: round.id } }).catch((e) => {
      console.warn("Không xóa được round (có dependency?):", e.message);
    });
  }
  console.log("Xong. (LearningEvent giữ nguyên vì append-only.)");
}

async function main() {
  if (process.argv.includes("--cleanup")) {
    await cleanup();
    return;
  }

  const count = Number(process.env.COUNT ?? "5000");
  const outputPath = process.env.OUTPUT ?? "./attempts.json";

  console.log(`Seed load test: ${count} attempt, xuất ra ${outputPath}`);

  const course = await findOrCreateCourse();
  const { examId, sessionId, questionIds } = await ensureExamSetup(
    course.id,
    course.ownerUserId,
  );

  const attempts = await seedAttempts(examId, sessionId, count);

  const out = attempts.map((a) => ({
    attemptId: a.attemptId,
    sessionToken: a.sessionToken,
    questionIds,
  }));
  writeFileSync(outputPath, JSON.stringify(out));
  console.log(`Đã ghi ${out.length} attempt vào ${outputPath}`);
  console.log(`Exam ID = ${examId} (truyền vào k6 qua EXAM_ID env nếu test dashboard SSE)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
