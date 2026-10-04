/**
 * Thêm một bài "Luyện tập" (kèm quiz) vào cuối các module 第二十X课 của một khoá
 * đã có. Không đụng tới bài học cũ.
 *   node --env-file=../db/.env.prod-import --import tsx scripts/add-quiz-lessons.ts \
 *     --file ../../docs/hoc-lieu/tieng-trung-iii-quiz/quiz.json --course <id> --owner <email> [--apply]
 * Không có --apply = chỉ kiểm tra, không ghi.
 */
import { readFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";
import { createLesson } from "../src/courses/lessons";
import { createQuiz } from "../src/quizzes/quizzes";
import { CreateQuestionInput, createQuestion } from "../src/quizzes/questions";
import { type QuestionSpec, expandQuestion } from "./import-course";
const QuestionSpecParse = { parse: (x: unknown) => x as QuestionSpec };

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const NUM = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const hanNum = (n: number) => (n < 20 ? "十" + NUM[n - 10] : "二十" + NUM[n - 20]);

async function main() {
  const data = JSON.parse(readFileSync(arg("file")!, "utf8")) as {
    n: string;
    title: string;
    questions: unknown[];
  }[];
  const courseId = arg("course")!;
  const apply = process.argv.includes("--apply");

  // Kiểm toàn bộ câu hỏi trước khi ghi.
  for (const d of data)
    d.questions.forEach((raw, qi) => {
      const q = QuestionSpecParse.parse(raw);
      const r = CreateQuestionInput.safeParse(expandQuestion(q, qi));
      if (!r.success) throw new Error(`Bài ${d.n} câu ${qi + 1}: ${JSON.stringify(r.error.flatten())}`);
    });
  console.log(`✔ ${data.reduce((a, d) => a + d.questions.length, 0)} câu hỏi hợp lệ`);

  const owner = await prisma.user.findUnique({ where: { email: arg("owner")! }, select: { id: true } });
  if (!owner) throw new Error("không thấy owner");
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true, status: true } });
  console.log("Khoá:", course);

  for (const d of data) {
    const modTitle = `第${hanNum(Number(d.n))}课`;
    const mod = await prisma.module.findFirst({ where: { courseId, title: modTitle }, include: { lessons: { select: { title: true, orderIndex: true } } } });
    if (!mod) throw new Error(`không thấy module ${modTitle}`);
    const lessonTitle = `Luyện tập — Bài ${d.n}`;
    if (mod.lessons.some((l) => l.title === lessonTitle)) {
      console.log(`  = ${modTitle}: đã có "${lessonTitle}", bỏ qua`);
      continue;
    }
    const next = Math.max(...mod.lessons.map((l) => l.orderIndex)) + 1;
    console.log(`  + ${modTitle}: thêm "${lessonTitle}" (orderIndex ${next}) với ${d.questions.length} câu`);
    if (!apply) continue;
    const { lessonId } = await createLesson(owner.id, mod.id, { title: lessonTitle, orderIndex: next });
    const { quizId } = await createQuiz(owner.id, { courseId, lessonId }, { title: `Luyện tập Bài ${d.n} — ${d.title}`, passThresholdPct: 70 });
    for (const [qi, raw] of d.questions.entries())
      await createQuestion(owner.id, quizId, expandQuestion(QuestionSpecParse.parse(raw), qi));
  }
  console.log(apply ? "Xong." : "Dry-run xong, chưa ghi gì.");
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
