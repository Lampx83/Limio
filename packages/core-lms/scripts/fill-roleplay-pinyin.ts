/**
 * Thêm pinyin vào các lượt đóng vai (`roleplay`) ĐÃ có trong một khoá, chỉ cho lượt chưa có pinyin — lượt giáo viên đã tự ghi giữ nguyên.
 *
 *   node --env-file=../db/.env.prod-import --import tsx scripts/fill-roleplay-pinyin.ts --course <courseId> --owner <email> --pinyin <map.json> [--dry-run]
 *
 * `--pinyin` = {"câu tiếng Trung": "pinyin"}. Lượt không có trong bảng thì báo và bỏ qua (không đoán). Không đổi audio, vai hay thứ tự lượt.
 */
import { readFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";
import { updateExamQuestion } from "../src/exam/questions";
import { fillRoleplayPinyin } from "./roleplay-pinyin";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const courseId = arg("course");
  const ownerEmail = arg("owner");
  const mapFile = arg("pinyin");
  const dryRun = process.argv.includes("--dry-run");
  if (!courseId || !ownerEmail || !mapFile) {
    console.error("Dùng: --course <courseId> --owner <email> --pinyin <map.json> [--dry-run]");
    process.exitCode = 1;
    return;
  }
  const map = JSON.parse(readFileSync(mapFile, "utf8")) as Record<string, string>;
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  if (!owner) throw new Error(`Không thấy tài khoản ${ownerEmail}`);
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });
  if (!course) throw new Error(`Không thấy khoá ${courseId}`);

  const qs = await prisma.examQuestion.findMany({
    where: { type: "essay", exam: { ownerContentItem: { lesson: { module: { courseId } } } } },
    select: { id: true, config: true },
  });
  let added = 0;
  let kept = 0;
  let questions = 0;
  const missing: string[] = [];
  for (const q of qs) {
    const r = fillRoleplayPinyin(q.config, map);
    if (!(q.config as { roleplay?: unknown } | null)?.roleplay) continue;
    questions += 1;
    added += r.added;
    kept += r.kept;
    missing.push(...r.missing);
    if (r.added > 0 && !dryRun) await updateExamQuestion(owner.id, q.id, { config: r.config });
  }
  console.log(`Khoá "${course.title}": ${questions} câu đóng vai · ${dryRun ? "sẽ thêm" : "đã thêm"} pinyin cho ${added} lượt · giữ nguyên ${kept} lượt đã có pinyin · ${missing.length} lượt không có trong bảng.`);
  for (const m of missing.slice(0, 10)) console.log(`  ⚠ thiếu: ${m}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
