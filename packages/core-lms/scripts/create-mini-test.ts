/**
 * Tạo mini-test cuối bài (Quiz gắn vào bài) từ một tệp JSON, bằng đúng `createQuiz`/`createQuestion` của hệ thống
 * (câu hỏi tự mang chủ đề của bài). Xem docs/tieu-chi/mini-test-cuoi-bai.md.
 *
 *   pnpm create:mini-test -- --owner gv@example.com --spec mini-test.json [--apply] [--replace]
 *
 * Tệp JSON: { lessonId, title, description?, timeLimitSec, questions: [{ type, prompt, explanation?, options?, extra?, audioFrom? }] }
 *   - `audioFrom`: tiền tố tên khối hội thoại của bài ("课文1A"); script gắn `extra.audioUrl` = audio cả đoạn của khối đó.
 * Không có --apply thì chỉ kiểm tra và in tóm tắt. Bài đã có quiz cùng tên thì dừng, trừ khi có --replace (xoá quiz cũ rồi tạo lại).
 * Mini-test không xáo thứ tự câu (giữ phần nghe, đọc, viết như đề HSK), không bắt chấm độ tự tin, điểm lấy lượt mới nhất, làm lại không giới hạn.
 */
import { readFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";
import { createQuestion, createQuiz, deleteQuiz } from "../src/quizzes";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface SpecQuestion {
  type: string;
  prompt: string;
  explanation?: string;
  options?: unknown[];
  extra?: Record<string, unknown>;
  audioFrom?: string;
}
interface Spec {
  lessonId: string;
  title: string;
  description?: string;
  timeLimitSec: number;
  questions: SpecQuestion[];
}

async function main() {
  const email = arg("owner");
  const specPath = arg("spec");
  if (!email || !specPath) throw new Error("Cần --owner <email> và --spec <tệp.json>");
  const apply = process.argv.includes("--apply");
  const replace = process.argv.includes("--replace");
  const spec = JSON.parse(readFileSync(specPath, "utf8")) as Spec;

  const owner = await prisma.user.findFirst({ where: { email }, select: { id: true } });
  if (!owner) throw new Error(`Không thấy người dùng ${email}`);
  const lesson = await prisma.lesson.findUnique({
    where: { id: spec.lessonId },
    select: { title: true, module: { select: { courseId: true } }, contentItems: { where: { type: "dialogue" }, select: { payload: true } } },
  });
  if (!lesson) throw new Error(`Không thấy bài ${spec.lessonId}`);
  const courseId = lesson.module.courseId;

  const audioOf = (prefix: string): string => {
    const hit = lesson.contentItems
      .map((c) => c.payload as { title?: string; audioUrl?: string })
      .find((p) => typeof p.title === "string" && p.title.startsWith(prefix) && typeof p.audioUrl === "string");
    if (!hit?.audioUrl) throw new Error(`Bài không có hội thoại "${prefix}" có audio`);
    return hit.audioUrl;
  };
  const questions = spec.questions.map((q) => {
    const { audioFrom, ...rest } = q;
    return audioFrom ? { ...rest, extra: { ...(rest.extra ?? {}), audioUrl: audioOf(audioFrom) } } : rest;
  });

  const existing = await prisma.quiz.findMany({ where: { lessonId: spec.lessonId, title: spec.title }, select: { id: true } });
  console.log(`Bài: ${lesson.title}\nMini-test: ${spec.title} — ${questions.length} câu, ${Math.round(spec.timeLimitSec / 60)} phút, ${questions.filter((q) => q.extra?.audioUrl).length} câu có audio`);
  if (existing.length > 0 && !replace) throw new Error(`Bài đã có quiz cùng tên (${existing.length}); thêm --replace để tạo lại`);
  if (!apply) {
    console.log("(chạy thử, chưa ghi gì)");
    return;
  }
  for (const e of existing) await deleteQuiz(owner.id, e.id);
  const { quizId } = await createQuiz(owner.id, { courseId, lessonId: spec.lessonId }, {
    title: spec.title,
    description: spec.description,
    timeLimitSec: spec.timeLimitSec,
    scoringPolicy: "latest",
    randomizeOrder: false,
    requireConfidence: false,
  });
  for (const q of questions) await createQuestion(owner.id, quizId, q);
  console.log(`Đã tạo quiz ${quizId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
