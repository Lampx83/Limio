/**
 * Tạo một quiz ĐỘC LẬP (không gắn bài học) từ file JSON, đi qua đúng đường UI
 * giảng viên đi — createQuiz → createQuestion — rồi ẩn quiz (isHidden) để học
 * viên đã ghi danh chưa thấy khi giảng viên đang thử.
 *   node --env-file=../db/.env.prod-import --import tsx scripts/add-standalone-quiz.ts \
 *     --file ../../docs/.../quiz.json --course-slug <slug> --owner <email> [--apply] [--visible]
 * Không có --apply = chỉ kiểm tra, không ghi. Chỉ THÊM; trùng tiêu đề trong khoá thì dừng.
 *
 * Quiz độc lập không được auto-tag Skill (xem CLAUDE.md §4.4), nên không đi vào Feedback Engine.
 */
import { readFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";
import { createQuiz, updateQuiz } from "../src/quizzes/quizzes";
import { CreateQuestionInput, createQuestion } from "../src/quizzes/questions";
import { type QuestionSpec, expandQuestion } from "./import-course";

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const spec = JSON.parse(readFileSync(arg("file")!, "utf8")) as {
    title: string;
    description?: string;
    questions: QuestionSpec[];
  };
  const apply = process.argv.includes("--apply");
  const hide = !process.argv.includes("--visible");

  const problems: string[] = [];
  spec.questions.forEach((q, qi) => {
    const r = CreateQuestionInput.safeParse(expandQuestion(q, qi));
    if (!r.success) problems.push(`câu ${qi + 1}: ${r.error.issues.map((i) => i.message).join("; ")}`);
    if (q.type === "mcq" && (q.options ?? []).filter((o) => o.isCorrect).length !== 1)
      problems.push(`câu ${qi + 1}: mcq phải có đúng 1 đáp án đúng`);
  });
  console.log(`${spec.questions.length} câu, ${spec.questions.reduce((a, q) => a + (q.points ?? 1), 0)} điểm`);

  const owner = await prisma.user.findUnique({ where: { email: arg("owner")! }, select: { id: true, displayName: true } });
  if (!owner) problems.push("không thấy owner");
  const course = await prisma.course.findUnique({ where: { slug: arg("course-slug")! }, select: { id: true, title: true, status: true } });
  if (!course) problems.push("không thấy khoá");
  const codes = [...new Set(spec.questions.flatMap((q) => (q.options ?? []).map((o) => o.misconception).filter(Boolean) as string[]))];
  const mcs = await prisma.misconception.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const mcIds = new Map(mcs.map((m) => [m.code, m.id]));
  const missing = codes.filter((c) => !mcIds.has(c));
  if (missing.length) problems.push(`thiếu misconception trong DB: ${missing.join(", ")}`);
  if (course) {
    const dup = await prisma.quiz.findFirst({ where: { courseId: course.id, title: spec.title }, select: { id: true } });
    if (dup) problems.push(`đã có quiz trùng tiêu đề (${dup.id})`);
  }
  console.log("Khoá:", course, "· Chủ:", owner?.displayName, `· misconception ${mcIds.size}/${codes.length}`);
  if (problems.length) {
    console.error("\nCó vấn đề, không ghi gì:");
    for (const p of problems) console.error(" -", p);
    process.exit(1);
  }
  if (!apply) return console.log("\nDry-run xong, chưa ghi gì.");

  const { quizId } = await createQuiz(owner!.id, { courseId: course!.id }, {
    title: spec.title,
    description: spec.description,
  });
  for (const [qi, q] of spec.questions.entries()) await createQuestion(owner!.id, quizId, expandQuestion(q, qi, mcIds));
  if (hide) await updateQuiz(owner!.id, quizId, { isHidden: true });
  console.log(`\nĐã tạo quiz ${quizId} (${hide ? "ẩn" : "hiện"}) với ${spec.questions.length} câu.`);
  console.log(`Mở: /instructor/courses/${course!.id}/quizzes/${quizId}`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
