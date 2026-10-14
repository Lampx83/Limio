/**
 * Tạo một Đề thi viết (Exam kind=written, trạng thái draft) gồm các câu mcq từ
 * file quiz.json (cùng dạng add-standalone-quiz.ts), đi qua createExam →
 * createExamQuestion. Tuỳ chọn --delete-quiz <id> xoá quiz LMS độc lập đã tạo
 * trước đó (chỉ khi chưa có lượt làm) — dùng khi chuyển quiz sang Đề thi.
 *   node --env-file=../db/.env.prod-import --import tsx scripts/add-written-exam.ts \
 *     --file quiz.json --course-slug <slug> --owner <email> --duration 30 [--delete-quiz <id>] [--apply]
 * Không có --apply = chỉ kiểm tra, không ghi. Chỉ THÊM; trùng tiêu đề trong khoá thì dừng.
 * Đề ở trạng thái draft: không mở cho ai cho tới khi giảng viên tạo ca thi và publish.
 */
import { readFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";
import { createExam } from "../src/exam/exams";
import { CreateExamQuestionInput, createExamQuestion } from "../src/exam/questions";
import { configSchemaForType } from "../src/exam/schemas";
import { deleteQuiz } from "../src/quizzes/quizzes";
import type { QuestionSpec } from "./import-course";

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

function toExamQuestion(q: QuestionSpec) {
  if (q.type !== "mcq") throw new Error(`chỉ hỗ trợ mcq, gặp ${q.type}`);
  return {
    type: "mcq" as const,
    prompt: q.prompt,
    points: q.points ?? 1,
    config: {
      options: (q.options ?? []).map((o, i) => ({ id: `o${i + 1}`, label: o.label, isCorrect: o.isCorrect })),
      ...(q.explanation ? { explanation: q.explanation } : {}),
    },
  };
}

async function main() {
  const spec = JSON.parse(readFileSync(arg("file")!, "utf8")) as { title: string; description?: string; questions: QuestionSpec[] };
  const apply = process.argv.includes("--apply");
  const durationMin = Number(arg("duration") ?? 30);
  const delQuiz = arg("delete-quiz");

  const problems: string[] = [];
  const qs = spec.questions.map(toExamQuestion);
  qs.forEach((q, i) => {
    const a = CreateExamQuestionInput.safeParse(q);
    if (!a.success) problems.push(`câu ${i + 1}: ${a.error.issues.map((x) => x.message).join("; ")}`);
    const c = configSchemaForType(q.type).safeParse(q.config);
    if (!c.success) problems.push(`câu ${i + 1} config: ${c.error.issues.map((x) => x.message).join("; ")}`);
  });
  const owner = await prisma.user.findUnique({ where: { email: arg("owner")! }, select: { id: true, displayName: true } });
  if (!owner) problems.push("không thấy owner");
  const course = await prisma.course.findUnique({ where: { slug: arg("course-slug")! }, select: { id: true, title: true } });
  if (!course) problems.push("không thấy khoá");
  if (course) {
    const dup = await prisma.exam.findFirst({ where: { courseId: course.id, title: spec.title }, select: { id: true } });
    if (dup) problems.push(`đã có đề trùng tiêu đề (${dup.id})`);
  }
  if (delQuiz) {
    const quiz = await prisma.quiz.findUnique({ where: { id: delQuiz }, select: { title: true, courseId: true, _count: { select: { attempts: true } } } });
    if (!quiz) problems.push("không thấy quiz cần xoá");
    else if (quiz._count.attempts > 0) problems.push(`quiz cần xoá đã có ${quiz._count.attempts} lượt làm`);
    else if (course && quiz.courseId !== course.id) problems.push("quiz không thuộc khoá này");
    else console.log("Sẽ xoá quiz LMS:", quiz.title);
  }
  console.log(`${qs.length} câu mcq, ${qs.reduce((a, q) => a + q.points, 0)} điểm · ${durationMin} phút · khoá: ${course?.title}`);
  if (problems.length) { console.error("\nCó vấn đề, không ghi gì:\n -", problems.join("\n - ")); process.exit(1); }
  if (!apply) return console.log("\nDry-run xong, chưa ghi gì.");

  const { examId } = await createExam(owner!.id, course!.id, {
    title: spec.title, description: spec.description, durationMin, kind: "written",
    shuffleQuestions: true, shuffleOptions: true, showResultsAfterSubmit: true,
  });
  for (const q of qs) await createExamQuestion(owner!.id, examId, q);
  console.log(`\nĐã tạo đề ${examId} (draft) với ${qs.length} câu.`);
  console.log(`Mở: /instructor/courses/${course!.id}/exams/${examId}`);
  if (delQuiz) { await deleteQuiz(owner!.id, delQuiz); console.log("Đã xoá quiz LMS", delQuiz); }
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
