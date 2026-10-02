/**
 * Thay NỘI DUNG của một quiz độc lập và một đề vấn đáp đã tạo (add-standalone-quiz.ts,
 * import-oral-exam.ts) bằng bản JSON mới. Chỉ chạy khi cả hai CHƯA có lượt làm nào.
 *   node --env-file=../db/.env.prod-import --import tsx scripts/revise-quiz-and-oral.ts \
 *     --owner <email> --quiz <id> --quiz-file quiz.json --exam <id> --oral-file van-dap.json [--apply]
 * Không có --apply = chỉ kiểm tra, không ghi.
 */
import { readFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";
import { updateQuiz } from "../src/quizzes/quizzes";
import { CreateQuestionInput, createQuestion } from "../src/quizzes/questions";
import { updateExam } from "../src/exam/exams";
import { createOralMaterialTopicList, deleteOralMaterial, listOralMaterials } from "../src/exam/oral-materials";
import { type QuestionSpec, expandQuestion } from "./import-course";

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const apply = process.argv.includes("--apply");
  const quizId = arg("quiz")!, examId = arg("exam")!;
  const qs = JSON.parse(readFileSync(arg("quiz-file")!, "utf8")) as { title: string; description?: string; questions: QuestionSpec[] };
  const oral = JSON.parse(readFileSync(arg("oral-file")!, "utf8")) as {
    title: string; description: string; examinerInstructions: string; oralRubricText: string;
    materials: { title: string; text: string }[];
  };
  const owner = await prisma.user.findUnique({ where: { email: arg("owner")! }, select: { id: true } });
  if (!owner) throw new Error("không thấy owner");

  const problems: string[] = [];
  qs.questions.forEach((q, qi) => {
    const r = CreateQuestionInput.safeParse(expandQuestion(q, qi));
    if (!r.success) problems.push(`câu ${qi + 1}: ${r.error.issues.map((i) => i.message).join("; ")}`);
    if (q.type === "mcq" && (q.options ?? []).filter((o) => o.isCorrect).length !== 1) problems.push(`câu ${qi + 1}: cần đúng 1 đáp án đúng`);
  });
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, select: { title: true, isHidden: true, _count: { select: { attempts: true, questions: true } } } });
  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { title: true, kind: true, status: true, _count: { select: { attempts: true } } } });
  if (!quiz) problems.push("không thấy quiz");
  else if (quiz._count.attempts > 0) problems.push(`quiz đã có ${quiz._count.attempts} lượt làm`);
  if (!exam) problems.push("không thấy đề vấn đáp");
  else if (exam.kind !== "oral") problems.push("đề không phải vấn đáp");
  else if (exam._count.attempts > 0) problems.push(`đề đã có ${exam._count.attempts} lượt thi`);
  const codes = [...new Set(qs.questions.flatMap((q) => (q.options ?? []).map((o) => o.misconception).filter(Boolean) as string[]))];
  const mcs = await prisma.misconception.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const mcIds = new Map(mcs.map((m) => [m.code, m.id]));
  if (codes.some((c) => !mcIds.has(c))) problems.push("thiếu misconception");
  console.log("Quiz:", quiz, "→", qs.questions.length, "câu mới");
  console.log("Đề:", exam, "→ thay mô tả, hướng dẫn giám khảo, rubric,", oral.materials.length, "tài liệu");
  if (problems.length) { console.error("\nCó vấn đề, không ghi gì:\n -", problems.join("\n - ")); process.exit(1); }
  if (!apply) return console.log("\nDry-run xong, chưa ghi gì.");

  await prisma.quizQuestion.deleteMany({ where: { quizId } });
  for (const [qi, q] of qs.questions.entries()) await createQuestion(owner.id, quizId, expandQuestion(q, qi, mcIds));
  await updateQuiz(owner.id, quizId, { title: qs.title, description: qs.description });

  await updateExam(owner.id, examId, {
    title: oral.title, description: oral.description,
    examinerInstructions: oral.examinerInstructions, oralRubricText: oral.oralRubricText,
  });
  for (const m of await listOralMaterials(owner.id, examId)) await deleteOralMaterial(owner.id, m.id);
  for (const m of oral.materials) await createOralMaterialTopicList(owner.id, examId, { title: m.title, text: m.text });
  console.log("\nĐã thay nội dung quiz và đề vấn đáp.");
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
