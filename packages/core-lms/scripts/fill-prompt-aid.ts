/**
 * Thêm chú giải đề (phiên âm + bản dịch) cho các câu hỏi ĐÃ có trong một khoá — không nhập lại khoá.
 *
 *   node --env-file=../db/.env.prod-import --import tsx scripts/fill-prompt-aid.ts --course <courseId> --owner <email> --aid <map.json> [--force] [--dry-run]
 *
 * `--aid` = {"đề câu hỏi": {"reading": "...", "translation": "..."}}, khớp theo nguyên văn đề. Câu đã có chú giải giữ nguyên (`--force`: ghi đè).
 * Không đổi đề, đáp án hay lựa chọn. Loại bài luyện nhúng của khoá (mọi loại câu), không đụng câu của đề thi khác.
 */
import { readFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";
import { updateExamQuestion } from "../src/exam/questions";
import { applyPromptAid, type PromptAidEntry } from "./prompt-aid";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const courseId = arg("course");
  const ownerEmail = arg("owner");
  const aidFile = arg("aid");
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  if (!courseId || !ownerEmail || !aidFile) {
    console.error("Dùng: --course <courseId> --owner <email> --aid <map.json> [--force] [--dry-run]");
    process.exitCode = 1;
    return;
  }
  const map = JSON.parse(readFileSync(aidFile, "utf8")) as Record<string, PromptAidEntry>;
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  if (!owner) throw new Error(`Không thấy tài khoản ${ownerEmail}`);
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });
  if (!course) throw new Error(`Không thấy khoá ${courseId}`);

  const qs = await prisma.examQuestion.findMany({
    where: { exam: { ownerContentItem: { lesson: { module: { courseId } } } } },
    select: { id: true, prompt: true, config: true },
  });
  const han = /[㐀-鿿]/;
  let added = 0;
  let kept = 0;
  const missing: string[] = [];
  for (const q of qs) {
    const r = applyPromptAid(q.config, q.prompt, map, force);
    if (r.status === "added") {
      added += 1;
      if (!dryRun) await updateExamQuestion(owner.id, q.id, { config: r.config });
    } else if (r.status === "kept") kept += 1;
    else if (han.test(q.prompt)) missing.push(q.prompt);
  }
  console.log(`Khoá "${course.title}": ${qs.length} câu · ${dryRun ? "sẽ thêm" : "đã thêm"} chú giải cho ${added} câu · giữ nguyên ${kept} câu đã có · ${missing.length} câu có chữ Hán nhưng không có trong bảng.`);
  for (const m of missing.slice(0, 10)) console.log(`  ⚠ thiếu: ${m.slice(0, 60)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
