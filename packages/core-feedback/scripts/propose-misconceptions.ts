/**
 * B9.3 bước 1 — đề xuất misconception cho phương án nhiễu chưa gắn.
 *
 * CHỈ ĐỌC. Không ghi gì vào DB ngoài AiUsageLog. Kết quả ra file JSON để
 * giảng viên duyệt, rồi mới chạy apply-misconceptions.ts.
 *
 *   pnpm --filter @feedbackme/core-feedback propose:misconceptions -- \
 *     --course=thiet-ke-ui-ux --out=./proposals-uiux.json
 *
 * Chạy với dữ liệu production: đặt DATABASE_URL trỏ sang prod. An toàn vì
 * script không ghi nội dung.
 */

import OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import {
  suggestMisconceptionsForQuestion,
  type MisconceptionProposal,
} from "../src/aiTutor/generators";
import fs from "node:fs";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

const courseSlug = arg("course");
const outPath = arg("out");
const limit = Number(arg("limit") ?? "0");
const model = arg("model") ?? "gpt-4o-mini";

/** Chỉ hai loại này khớp được misconception — xem AC nhóm 1. */
const TAGGABLE = ["mcq", "true_false"] as const;

async function resolveOpenAiKey(): Promise<string> {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  // Khoá thật nằm trong IntegrationCredential (đã mã hoá). core-lms là
  // devDependency của package này, dùng được trong script tooling.
  const { getIntegrationSecret } = await import("@feedbackme/core-lms");
  return getIntegrationSecret("openai");
}

async function main() {
  if (!courseSlug || !outPath) {
    console.error(
      "Thiếu tham số. Ví dụ:\n  --course=thiet-ke-ui-ux --out=./proposals.json [--limit=20] [--model=gpt-4o]",
    );
    process.exitCode = 1;
    return;
  }

  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true, slug: true, title: true },
  });
  if (!course) {
    console.error(`Không tìm thấy course slug=${courseSlug}`);
    process.exitCode = 1;
    return;
  }

  // Người chịu trách nhiệm — dùng để ghi AiUsageLog.
  const owner = await prisma.courseInstructor.findFirst({
    where: { courseId: course.id, role: "owner" },
    select: { userId: true },
  });
  if (!owner) {
    console.error("Course không có owner — không xác định được actor để log usage.");
    process.exitCode = 1;
    return;
  }

  // AC-2.1 — câu taggable còn ít nhất một phương án sai chưa gắn.
  const questions = await prisma.quizQuestion.findMany({
    where: {
      quiz: { courseId: course.id },
      type: { in: [...TAGGABLE] },
      options: { some: { isCorrect: false, misconceptionId: null } },
    },
    select: {
      id: true,
      type: true,
      prompt: true,
      options: {
        orderBy: { orderIndex: "asc" },
        select: { id: true, label: true, isCorrect: true, misconceptionId: true },
      },
      quiz: { select: { lesson: { select: { title: true } } } },
    },
    orderBy: { id: "asc" },
    ...(limit > 0 ? { take: limit } : {}),
  });

  if (questions.length === 0) {
    console.log("Không có câu nào cần đề xuất.");
    return;
  }

  // Log trước khi lấy khoá API — thiếu khoá thì vẫn thấy được phạm vi công việc.
  console.log(
    `Khoá: ${course.title} (${course.slug})\n` +
      `Câu cần xử lý: ${questions.length} · model=${model}\n`,
  );

  const openai = new OpenAI({ apiKey: await resolveOpenAiKey() });

  const items: Array<{
    questionId: string;
    type: string;
    lesson: string | null;
    prompt: string;
    correct: string;
    options: Array<MisconceptionProposal & { skip: boolean }>;
  }> = [];

  let done = 0;
  let proposed = 0;
  let declined = 0;

  for (const q of questions) {
    // Chỉ gửi phương án CHƯA gắn; cái đã gắn giữ nguyên, không đụng vào.
    const pending = q.options.filter((o) => !o.isCorrect && o.misconceptionId === null);
    try {
      const proposals = await suggestMisconceptionsForQuestion(
        owner.userId,
        {
          questionId: q.id,
          prompt: q.prompt,
          lessonTitle: q.quiz.lesson?.title,
          options: [
            ...q.options.filter((o) => o.isCorrect),
            ...pending,
          ].map((o) => ({ id: o.id, label: o.label, isCorrect: o.isCorrect })),
        },
        openai,
        model,
      );

      proposed += proposals.filter((p) => p.misconceptionCode !== null).length;
      declined += proposals.filter((p) => p.misconceptionCode === null).length;

      items.push({
        questionId: q.id,
        type: q.type,
        lesson: q.quiz.lesson?.title ?? null,
        prompt: q.prompt,
        correct: q.options.filter((o) => o.isCorrect).map((o) => o.label).join(" / "),
        options: proposals.map((p) => ({ ...p, skip: false })),
      });
    } catch (e) {
      console.error(`  ! câu ${q.id}: ${(e as Error).message}`);
    }

    done += 1;
    if (done % 10 === 0) console.log(`  ...${done}/${questions.length}`);
  }

  const payload = {
    course: course.slug,
    generatedAt: new Date().toISOString(),
    model,
    huongDan:
      "Duyệt từng phương án. Đặt skip=true để bỏ qua. Sửa thoải mái misconceptionCode / feedbackBody. " +
      "misconceptionCode=null nghĩa là phương án đó không lộ hiểu nhầm nào — để nguyên là hợp lệ.",
    items,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

  console.log(
    `\nXong. ${items.length} câu → ${outPath}\n` +
      `  đề xuất gắn: ${proposed}\n` +
      `  để trống (không lộ hiểu nhầm): ${declined}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
