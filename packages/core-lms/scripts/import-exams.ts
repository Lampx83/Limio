/**
 * LANG L6.8 — nhập hàng loạt đề thi thử MỘT-kỹ-năng vào một khoá luyện đề, đi qua đúng các hàm dịch vụ giao diện dùng
 * (createExam → createSection → createPassage → createExamQuestion). Đề tạo ở trạng thái NHÁP; chạy lại không tạo trùng
 * (nhận biết theo nguồn + số thứ tự).
 *
 *   pnpm import:exams -- --file ./de-hsk4-nghe.json --course <id|slug> --owner gv@example.com --dry-run
 *   pnpm import:exams -- --file ./de-hsk4-nghe.json --course <id|slug> --owner gv@example.com
 *   pnpm import:exams -- --file ./de.json --course hsk-4-nghe --owner gv@example.com --skill listening --publish
 *
 * Khuôn file: xem packages/core-lms/src/exam/import-manifest.ts (mảng `exams`, mỗi đề có `title`, `skill`, `collection`,
 * `seq`, `paperType`, `sourceLabel`, `yearLabel`, `difficulty`, `tags`, `passages[{title,text,audioUrl}]`,
 * `questions[{type:"mcq",prompt,options[{label,correct}],passage?}]`). Audio là file đã tải lên hệ thống (/api/lesson-media/...).
 *
 * `--dry-run` kiểm tra TOÀN BỘ manifest và in kết quả từng đề, không ghi gì.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@feedbackme/db";
import { importExamManifest } from "../src/exam/import-manifest";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const file = arg("file");
  const courseRef = arg("course");
  const ownerEmail = arg("owner");
  if (!file || !courseRef || !ownerEmail) {
    console.error(
      "Cách dùng: pnpm import:exams -- --file <manifest.json> --course <id|slug> --owner <email> [--skill listening|reading|writing|speaking] [--publish] [--dry-run]",
    );
    process.exit(2);
  }
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!owner) throw new Error(`Không thấy tài khoản ${ownerEmail}`);
  const course = await prisma.course.findFirst({ where: { OR: [{ id: courseRef }, { slug: courseRef }] }, select: { id: true, title: true, kind: true } });
  if (!course) throw new Error(`Không thấy khoá "${courseRef}"`);
  if (course.kind !== "practice_bank") console.warn(`⚠ Khoá "${course.title}" không phải khoá luyện đề (practice_bank) — vẫn nhập được nhưng thư viện học viên chỉ hiện ở khoá luyện đề.`);

  const manifest = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  const skill = arg("skill") as "listening" | "reading" | "writing" | "speaking" | undefined;
  const dryRun = process.argv.includes("--dry-run");
  const r = await importExamManifest(owner.id, course.id, manifest, { dryRun, publish: process.argv.includes("--publish"), defaultSkill: skill });
  for (const x of r.results) {
    const mark = x.status === "created" ? "✓" : x.status === "would_create" ? "·" : x.status === "skipped_duplicate" ? "=" : "✗";
    console.log(`${mark} [${x.index}] ${x.title} — ${x.status}${x.published ? " (đã xuất bản)" : ""}`);
    for (const e of x.errors) console.log(`     ${e}`);
  }
  const s = r.summary;
  console.log(`\n${dryRun ? "(dry-run) " : ""}Tổng ${s.total}: tạo ${s.created}${dryRun ? `, sẽ tạo ${s.wouldCreate}` : ""}, bỏ qua trùng ${s.skipped}, lỗi ${s.failed}.`);
  process.exit(s.failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
