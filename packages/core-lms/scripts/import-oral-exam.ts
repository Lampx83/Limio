/**
 * Tạo một đề Vấn đáp AI (Exam kind=oral) từ file JSON, đi qua đúng đường UI
 * giảng viên đi — createExam → createOralMaterialTopicList — thay vì INSERT tay.
 *
 *   pnpm import:oral -- --file ./van-dap.json --owner gv@example.com --dry-run
 *   pnpm import:oral:prod -- --file ./van-dap.json --owner gv@example.com
 *
 * Đề tạo ra ở trạng thái `draft`: KHÔNG mở cho sinh viên. Giảng viên tự bấm
 * "Thử vấn đáp" rồi publish khi hài lòng. Chạy vào production: mở đường hầm SSH
 * như hướng dẫn đầu import-course.ts.
 *
 * Chỉ THÊM đề mới; trùng tiêu đề trong cùng khoá thì dừng.
 *
 * Giới hạn (do CreateExamInput): examinerInstructions ≤ 5.000 ký tự,
 * oralRubricText ≤ 20.000, description ≤ 20.000; mỗi tài liệu chủ đề ≤ 50.000.
 *
 * LƯU Ý về embedding: tài liệu tạo ở đây CHƯA được cắt đoạn và nhúng vector —
 * bước đó gọi OpenAI bằng khoá của máy chủ (getIntegrationSecret), mà máy chạy
 * script thường không có khoá. Khi chưa nhúng, giám khảo ảo vẫn chạy, chỉ là
 * không lấy được đoạn tài liệu và dựa vào examinerInstructions.
 */

import { readFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";
import { z } from "zod";
import { createExam } from "../src/exam/exams";
import { createOralMaterialTopicList } from "../src/exam/oral-materials";
import { isFeatureEnabled } from "../src/auth/permissions";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const Spec = z.object({
  courseSlug: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(20_000).optional(),
  durationMin: z.number().int().positive(),
  language: z.enum(["vi", "en", "zh"]).default("vi"),
  answerMode: z.enum(["text", "voice"]).default("text"),
  attemptPolicy: z.enum(["single", "multi"]).default("single"),
  maxAttempts: z.number().int().min(2).max(10).optional(),
  examinerInstructions: z.string().max(5_000).optional(),
  oralRubricText: z.string().max(20_000).optional(),
  materials: z
    .array(z.object({ type: z.literal("topic_list"), title: z.string().min(1).max(200), text: z.string().min(1).max(50_000) }))
    .min(1),
});

async function main() {
  const file = arg("file");
  const ownerEmail = arg("owner");
  const dryRun = process.argv.includes("--dry-run");
  if (!file || !ownerEmail) {
    console.error("Cần --file <van-dap.json> và --owner <email>");
    process.exit(1);
  }
  const parsed = Spec.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) {
    console.error("File không đúng dạng:", JSON.stringify(parsed.error.flatten(), null, 1));
    process.exit(1);
  }
  const spec = parsed.data;

  const problems: string[] = [];
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true, displayName: true } });
  if (!owner) problems.push(`Không có tài khoản nào với email ${ownerEmail}`);
  const course = await prisma.course.findUnique({ where: { slug: spec.courseSlug }, select: { id: true, title: true } });
  if (!course) problems.push(`Không có khoá học với slug ${spec.courseSlug}`);

  let feature: boolean | null = null;
  if (owner && course) {
    const dup = await prisma.exam.findFirst({ where: { courseId: course.id, title: spec.title }, select: { id: true } });
    if (dup) problems.push(`Đã có đề trùng tiêu đề (${dup.id}). Xoá nó trong giao diện rồi chạy lại.`);
    try {
      feature = await isFeatureEnabled(owner.id, "ai_oral.access");
    } catch {
      feature = null;
    }
  }

  console.log(`Đề: ${spec.title}`);
  console.log(`Khoá: ${course?.title ?? "(không thấy)"} · Chủ: ${owner ? `${owner.displayName} <${ownerEmail}>` : "(không thấy)"}`);
  console.log(`${spec.durationMin} phút · ${spec.language} · trả lời ${spec.answerMode} · ${spec.attemptPolicy}${spec.maxAttempts ? ` (tối đa ${spec.maxAttempts})` : ""}`);
  console.log(
    `Hướng dẫn giám khảo ${spec.examinerInstructions?.length ?? 0}/5000 · rubric ${spec.oralRubricText?.length ?? 0}/20000 · tài liệu ${spec.materials.length}`,
  );
  console.log(`Quyền ai_oral.access của chủ đề: ${feature === null ? "không kiểm được" : feature ? "có" : "KHÔNG (không mở được trang vấn đáp)"}`);

  if (problems.length) {
    console.error("\nCó vấn đề, không ghi gì:");
    for (const p of problems) console.error(" -", p);
    process.exit(1);
  }
  if (dryRun) {
    console.log("\n--dry-run: hợp lệ, chưa ghi gì.");
    return;
  }

  const { examId } = await createExam(owner!.id, course!.id, {
    title: spec.title,
    description: spec.description,
    durationMin: spec.durationMin,
    kind: "oral",
    language: spec.language,
    answerMode: spec.answerMode,
    attemptPolicy: spec.attemptPolicy,
    ...(spec.maxAttempts ? { maxAttempts: spec.maxAttempts } : {}),
    proctoringLevel: "none",
    examinerInstructions: spec.examinerInstructions,
    oralRubricText: spec.oralRubricText,
  });
  for (const m of spec.materials) {
    await createOralMaterialTopicList(owner!.id, examId, { title: m.title, text: m.text });
  }
  console.log(`\nĐã tạo đề ${examId} (draft) với ${spec.materials.length} tài liệu.`);
  console.log(`Mở: /instructor/courses/${course!.id}/exams/${examId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
