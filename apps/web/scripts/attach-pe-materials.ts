/**
 * Đính kèm tài liệu của giảng viên vào khoá "Prompt Engineering".
 *
 *   tsx scripts/attach-pe-materials.ts <materials-dir> [--url-map map.json] [--dry-run]
 *
 * <materials-dir> gồm: syllabus.pdf, notes.pdf, slides-150.pdf, slides-81.pdf, activity-1.pdf, activity-2.pdf,
 * activity-3.pdf (bản Student), retail-sales.csv.
 *
 * Gắn (luôn ở CUỐI bài, không đụng gì đã có):
 *   - "Course Syllabus": đề cương gốc (PDF)
 *   - mỗi bài "Module N materials …": lecture notes, 2 bộ slide, các activity sheet liên quan và CSV
 *       M1, M2: cả 3 activity (xem trước) · M3: Activity 1, 2 · M4, M5: Activity 3
 *
 * Mỗi tệp chỉ được tải lên MỘT lần rồi dùng chung URL cho mọi bài nhắc tới nó. Idempotent theo từng bài:
 * bài đã có khối PDF cùng tiêu đề (hoặc khối file cùng tên) thì bỏ qua.
 *
 * Kho tệp: mặc định ghi qua storage adapter (đĩa local ở máy dev — đặt UPLOADS_ROOT để trỏ thư mục nháp).
 * Với `--url-map map.json` ({ "notes.pdf": "/api/lesson-media/pdfs/<tên>.pdf", "retail-sales.csv":
 * "/api/lesson-media/files/<tên>.csv", … }) thì KHÔNG tải gì lên: dùng cho prod, nơi tệp đã được đặt sẵn vào S3.
 */
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@feedbackme/db";
import { createContentItem } from "@feedbackme/core-lms";
import { storageFor } from "../src/lib/storage";
import { lessonFileKey, lessonPdfKey } from "../src/lib/storage-keys";

const COURSE_SLUG = "prompt-engineering";
const CSV_NAME = "Slidescope_Retail_Store_Sales_Enhanced_2025.csv";

type Kind = "pdf" | "file";
interface Asset {
  file: string;
  kind: Kind;
  title: string; // tiêu đề khối PDF, hoặc tên hiển thị (filename) của khối file
}

const A = {
  syllabus: { file: "syllabus.pdf", kind: "pdf", title: "Original Syllabus (PDF)" },
  notes: { file: "notes.pdf", kind: "pdf", title: "Lecture notes — whole course (PDF)" },
  s150: { file: "slides-150.pdf", kind: "pdf", title: "Slides — full deck, 150 pages (PDF)" },
  s81: { file: "slides-81.pdf", kind: "pdf", title: "Slides — short deck, 81 pages (PDF)" },
  a1: { file: "activity-1.pdf", kind: "pdf", title: "Activity 1 — AI-Assisted Retail Data Visualisation (student sheet, PDF)" },
  a2: { file: "activity-2.pdf", kind: "pdf", title: "Activity 2 — Human vs AI-Assisted Prompt Design, A/B/C (student sheet, PDF)" },
  a3: { file: "activity-3.pdf", kind: "pdf", title: "Activity 3 — Evidence-Based Retail Decision Making (student sheet, PDF)" },
  csv: { file: "retail-sales.csv", kind: "file", title: CSV_NAME },
} satisfies Record<string, Asset>;

/** Bài (khớp đầu tiêu đề) → các tệp gắn vào bài đó, theo thứ tự. */
const PLAN: Array<{ lesson: string; assets: Asset[] }> = [
  { lesson: "Course Syllabus", assets: [A.syllabus] },
  { lesson: "Module 1 materials", assets: [A.notes, A.s150, A.s81, A.a1, A.a2, A.a3, A.csv] },
  { lesson: "Module 2 materials", assets: [A.notes, A.s150, A.s81, A.a1, A.a2, A.a3, A.csv] },
  { lesson: "Module 3 materials", assets: [A.notes, A.s150, A.s81, A.a1, A.a2, A.csv] },
  { lesson: "Module 4 materials", assets: [A.notes, A.s150, A.s81, A.a3, A.csv] },
  { lesson: "Module 5 materials", assets: [A.notes, A.s150, A.s81, A.a3, A.csv] },
];

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const mapPath = args.includes("--url-map") ? args[args.indexOf("--url-map") + 1] : undefined;
  const dir = args.find((a) => !a.startsWith("--") && a !== mapPath);
  if (!dir) {
    console.error("usage: attach-pe-materials.ts <materials-dir> [--url-map map.json] [--dry-run]");
    process.exit(1);
  }
  const urlMap: Record<string, string> = mapPath ? JSON.parse(await readFile(mapPath, "utf8")) : {};

  const used = new Set(PLAN.flatMap((p) => p.assets.map((a) => a.file)));
  for (const f of used) {
    if (mapPath ? !urlMap[f] : !existsSync(join(dir, f))) throw new Error(`missing ${mapPath ? "url for" : "file"}: ${f}`);
  }

  const course = await prisma.course.findUnique({ where: { slug: COURSE_SLUG } });
  if (!course) throw new Error(`no course ${COURSE_SLUG}`);
  const owner = await prisma.courseInstructor.findFirst({ where: { courseId: course.id, role: "owner" }, select: { userId: true } });
  if (!owner) throw new Error("course has no owner");
  const actor = owner.userId;

  const lessons = await prisma.lesson.findMany({
    where: { module: { courseId: course.id } },
    select: { id: true, title: true, contentItems: { select: { type: true, orderIndex: true, payload: true }, orderBy: { orderIndex: "asc" } } },
  });
  const find = (prefix: string) => {
    const hits = lessons.filter((l) => l.title.startsWith(prefix));
    if (hits.length !== 1) throw new Error(`expected 1 lesson for "${prefix}", found ${hits.length}`);
    return hits[0]!;
  };

  const uploaded = new Map<string, { url: string; size: number }>();
  async function urlFor(a: Asset): Promise<{ url: string; size: number }> {
    const hit = uploaded.get(a.file);
    if (hit) return hit;
    const buf = await readFile(join(dir!, a.file)).catch(() => Buffer.alloc(0));
    let url = urlMap[a.file];
    if (!url) {
      if (a.kind === "pdf" && buf.subarray(0, 4).toString() !== "%PDF") throw new Error(`not a PDF: ${a.file}`);
      if (buf.byteLength === 0) throw new Error(`empty: ${a.file}`);
      const now = new Date();
      const ext = a.kind === "pdf" ? "pdf" : "csv";
      const filename = `${actor}-${now.getTime()}-${randomBytes(8).toString("hex")}.${ext}`;
      const key = a.kind === "pdf" ? lessonPdfKey(now, filename) : lessonFileKey(now, filename);
      await storageFor(key).put(key.key, buf, a.kind === "pdf" ? "application/pdf" : "text/csv; charset=utf-8");
      url = `/api/lesson-media/${a.kind === "pdf" ? "pdfs" : "files"}/${filename}`;
    }
    const r = { url, size: buf.byteLength };
    uploaded.set(a.file, r);
    return r;
  }

  let added = 0;
  const outMap: Record<string, string> = {};
  for (const step of PLAN) {
    const l = find(step.lesson);
    let order = Math.max(-1, ...l.contentItems.map((c) => c.orderIndex)) + 1;
    for (const a of step.assets) {
      const has = l.contentItems.some((c) => {
        const p = c.payload as { title?: string; filename?: string };
        return a.kind === "pdf" ? c.type === "pdf" && p.title === a.title : c.type === "file" && p.filename === a.title;
      });
      if (has) {
        console.log(`= "${l.title.slice(0, 40)}": đã có ${a.file}`);
        continue;
      }
      if (dryRun) {
        console.log(`(dry-run) "${l.title.slice(0, 40)}" ← ${a.file}`);
        continue;
      }
      const { url, size } = await urlFor(a);
      outMap[a.file] = url;
      const payload = a.kind === "pdf" ? { url, title: a.title } : { url, filename: a.title, sizeBytes: size, mimeType: "text/csv" };
      await createContentItem(actor, l.id, { type: a.kind, payload, orderIndex: order++ }, prisma);
      added++;
      console.log(`✔ "${l.title.slice(0, 40)}" ← ${a.file}`);
    }
  }
  if (!dryRun && !mapPath && Object.keys(outMap).length) {
    const out = join(dir, "url-map.json");
    await writeFile(out, JSON.stringify(outMap, null, 2) + "\n");
    console.log(`\nĐã ghi ${out} (tệp → URL) — dùng cho bước đưa lên prod.`);
  }
  console.log(dryRun ? "\nDry run — nothing written." : `\nĐã thêm ${added} khối.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
