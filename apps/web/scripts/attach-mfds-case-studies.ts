/**
 * Đính kèm 3 case study của giảng viên vào khoá "Mathematical Foundations for Data Science".
 *
 *   tsx scripts/attach-mfds-case-studies.ts <dir> [--dry-run]
 *
 * <dir> gồm la-/calc-/prob-assignment.pdf (chỉ phần ĐỀ) và la-/calc-/prob-solutions.pdf (chỉ phần đáp án) — tách từ PDF gốc
 * của giảng viên (đề và đáp án nằm chung một tệp).
 *
 * Mỗi case study thành HAI khối PDF ở CUỐI bài "Part N materials …": đề (học viên thấy) và đáp án (`isHidden = true`, chỉ
 * người sửa được khoá thấy). Khối "đề + đáp án" gắn ở lần đầu (tiêu đề cũ) được đổi sang bản chỉ có đề.
 * Idempotent theo tiêu đề khối. Tệp được tải lên trước khi tạo/sửa dòng trỏ tới nó.
 */
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@feedbackme/db";
import { createContentItem, updateContentItem } from "@feedbackme/core-lms";
import { storageFor } from "../src/lib/storage";
import { lessonPdfKey } from "../src/lib/storage-keys";

const COURSE_SLUG = "mathematical-foundations-for-data-science";

const PLAN: Array<{ lesson: string; key: string; name: string }> = [
  { lesson: "Part I materials", key: "la", name: "Forecasting and analysing traffic flow across a campus network" },
  { lesson: "Part II materials", key: "calc", name: "Predicting module duration" },
  { lesson: "Part III materials", key: "prob", name: "Controlling package fill weights" },
];

async function uploadPdf(filePath: string, actor: string): Promise<string> {
  const buf = await readFile(filePath);
  if (buf.byteLength === 0 || buf.subarray(0, 4).toString() !== "%PDF") throw new Error(`not a PDF: ${filePath}`);
  const now = new Date();
  const filename = `${actor}-${now.getTime()}-${randomBytes(8).toString("hex")}.pdf`;
  const key = lessonPdfKey(now, filename);
  await storageFor(key).put(key.key, buf, "application/pdf");
  return `/api/lesson-media/pdfs/${filename}`;
}

async function main() {
  const dir = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!dir || dir.startsWith("--")) {
    console.error("usage: attach-mfds-case-studies.ts <dir> [--dry-run]");
    process.exit(1);
  }
  for (const p of PLAN) for (const k of ["assignment", "solutions"]) if (!existsSync(join(dir, `${p.key}-${k}.pdf`))) throw new Error(`missing: ${p.key}-${k}.pdf`);

  const course = await prisma.course.findUnique({ where: { slug: COURSE_SLUG } });
  if (!course) throw new Error(`no course ${COURSE_SLUG}`);
  const owner = await prisma.courseInstructor.findFirst({ where: { courseId: course.id, role: "owner" }, select: { userId: true } });
  if (!owner) throw new Error("course has no owner");
  const actor = owner.userId;

  // Chỉ đọc khối PDF: prod có loại nội dung mới hơn client này (vd. vocab_list) mà Prisma không đọc được.
  const lessons = await prisma.lesson.findMany({
    where: { module: { courseId: course.id } },
    select: { id: true, title: true, contentItems: { where: { type: "pdf" }, select: { id: true, isHidden: true, payload: true } } },
  });

  for (const p of PLAN) {
    const hits = lessons.filter((l) => l.title.startsWith(p.lesson));
    if (hits.length !== 1) throw new Error(`expected 1 lesson for "${p.lesson}", found ${hits.length}`);
    const l = hits[0]!;
    const oldTitle = `Case study — ${p.name} (assignment and solutions, PDF)`;
    const aTitle = `Case study — ${p.name} (assignment, PDF)`;
    const sTitle = `Case study — ${p.name} — solutions (instructors only, PDF)`;
    const find = (t: string) => l.contentItems.find((c) => (c.payload as { title?: string }).title === t);

    // 1) Đề: đổi khối "đề + đáp án" cũ sang bản chỉ có đề (hoặc tạo mới nếu chưa có).
    const old = find(oldTitle);
    if (find(aTitle)) console.log(`= "${p.key}": đã có khối đề`);
    else if (dryRun) console.log(`(dry-run) "${p.key}": ${old ? "đổi khối cũ sang" : "thêm"} khối đề`);
    else {
      const url = await uploadPdf(join(dir, `${p.key}-assignment.pdf`), actor);
      if (old) {
        await updateContentItem(actor, old.id, { payload: { url, title: aTitle } }, prisma);
        console.log(`↻ "${p.key}": khối cũ → chỉ còn đề ${url}`);
      } else {
        const agg = await prisma.contentItem.aggregate({ where: { lessonId: l.id }, _max: { orderIndex: true } });
        await createContentItem(actor, l.id, { type: "pdf", payload: { url, title: aTitle }, orderIndex: (agg._max.orderIndex ?? -1) + 1 }, prisma);
        console.log(`✔ "${p.key}": thêm khối đề ${url}`);
      }
    }

    // 2) Đáp án: khối riêng, ẩn với học viên.
    const sol = find(sTitle);
    if (sol) {
      if (!sol.isHidden && !dryRun) {
        await updateContentItem(actor, sol.id, { isHidden: true }, prisma);
        console.log(`🔒 "${p.key}": ẩn khối đáp án`);
      } else console.log(`= "${p.key}": đã có khối đáp án (ẩn=${sol.isHidden})`);
    } else if (dryRun) console.log(`(dry-run) "${p.key}": thêm khối đáp án (ẩn)`);
    else {
      const url = await uploadPdf(join(dir, `${p.key}-solutions.pdf`), actor);
      const agg = await prisma.contentItem.aggregate({ where: { lessonId: l.id }, _max: { orderIndex: true } });
      const created = await createContentItem(actor, l.id, { type: "pdf", payload: { url, title: sTitle }, orderIndex: (agg._max.orderIndex ?? -1) + 1 }, prisma);
      await updateContentItem(actor, created.contentItemId, { isHidden: true }, prisma);
      console.log(`✔🔒 "${p.key}": thêm khối đáp án (ẩn) ${url}`);
    }
  }
  console.log(dryRun ? "\nDry run — nothing written." : "\nXong.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
