/**
 * Thay TOÀN BỘ câu hỏi (mcq) của một Đề thi viết đã tạo bằng bản quiz.json mới.
 * Chỉ chạy khi đề chưa có lượt thi nào.
 *   node --env-file=../db/.env.prod-import --import tsx scripts/revise-written-exam.ts \
 *     --owner <email> --exam <id> --file quiz.json [--apply]
 */
import { readFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";
import { CreateExamQuestionInput, createExamQuestion } from "../src/exam/questions";
import { configSchemaForType } from "../src/exam/schemas";
import type { QuestionSpec } from "./import-course";

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const toQ = (q: QuestionSpec) => ({
  type: "mcq" as const,
  prompt: q.prompt,
  points: q.points ?? 1,
  config: {
    options: (q.options ?? []).map((o, i) => ({ id: `o${i + 1}`, label: o.label, isCorrect: o.isCorrect })),
    ...(q.explanation ? { explanation: q.explanation } : {}),
  },
});

async function main() {
  const apply = process.argv.includes("--apply");
  const examId = arg("exam")!;
  const spec = JSON.parse(readFileSync(arg("file")!, "utf8")) as { questions: QuestionSpec[] };
  const qs = spec.questions.map(toQ);
  const problems: string[] = [];
  qs.forEach((q, i) => {
    const a = CreateExamQuestionInput.safeParse(q);
    if (!a.success) problems.push(`câu ${i + 1}: ${a.error.issues.map((x) => x.message).join("; ")}`);
    const c = configSchemaForType("mcq").safeParse(q.config);
    if (!c.success) problems.push(`câu ${i + 1} config: ${c.error.issues.map((x) => x.message).join("; ")}`);
  });
  const owner = await prisma.user.findUnique({ where: { email: arg("owner")! }, select: { id: true } });
  if (!owner) problems.push("không thấy owner");
  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { title: true, kind: true, status: true, _count: { select: { attempts: true, questions: true } } } });
  if (!exam) problems.push("không thấy đề");
  else if (exam.kind !== "written") problems.push("đề không phải thi viết");
  else if (exam._count.attempts > 0) problems.push(`đề đã có ${exam._count.attempts} lượt thi`);
  console.log("Đề:", exam, "→", qs.length, "câu mới");
  if (problems.length) { console.error("\nCó vấn đề, không ghi gì:\n -", problems.join("\n - ")); process.exit(1); }
  if (!apply) return console.log("\nDry-run xong, chưa ghi gì.");
  await prisma.examQuestion.deleteMany({ where: { examId } });
  for (const q of qs) await createExamQuestion(owner!.id, examId, q);
  console.log(`\nĐã thay ${qs.length} câu của đề ${examId}.`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
