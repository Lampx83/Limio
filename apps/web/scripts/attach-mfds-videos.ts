/**
 * Gắn video bài giảng (đã dựng ghép phòng giảng + slide) vào khoá "Mathematical Foundations for Data Science".
 *
 *   tsx scripts/attach-mfds-videos.ts <videos-dir> [--dry-run] [--replace 3,6,8,9]
 *
 * <videos-dir> gồm la_t1..t5.mp4 (Part I) và calc_t6..t9.mp4 (Part II), cắt theo Topic.
 * Probability and Statistics (Part III) chưa có bản quay nên chưa có file.
 *
 * Mỗi video đặt ĐẦU bài "Topic N" tương ứng; các khối còn lại giữ nguyên thứ tự, lùi xuống một nấc.
 * Idempotent: bài đã có khối video cùng tiêu đề thì bỏ qua. `--replace N,M` (số Topic): với các Topic đó, nếu khối đã có thì
 * tải bản video + phụ đề mới lên rồi đổi url / transcriptUrl / durationSec của khối (bản cũ giữ trong kho để hoàn tác). Tệp được tải lên trước khi tạo dòng trỏ tới nó.
 */
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@feedbackme/db";
import { createContentItem, deleteContentItem, updateContentItem } from "@feedbackme/core-lms";
import { storageFor } from "../src/lib/storage";
import { lessonTranscriptKey, lessonVideoKey } from "../src/lib/storage-keys";

const COURSE_SLUG = "mathematical-foundations-for-data-science";
const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;

const PLAN: Array<{ lesson: string; file: string; title: string; caption: string }> = [
  { lesson: "Topic 1 ", file: "la_t1.mp4", title: "Lecture video — Topic 1: Linear Systems", caption: "Linear equations, augmented matrices, elementary row operations and Gaussian elimination." },
  { lesson: "Topic 2 ", file: "la_t2.mp4", title: "Lecture video — Topic 2: Matrix Operations and Inverse Matrices", caption: "Special matrices, addition, scalar multiplication, matrix product, transpose, inverse and Gauss-Jordan." },
  { lesson: "Topic 3 ", file: "la_t3.mp4", title: "Lecture video — Topic 3: Determinants", caption: "2 × 2 determinant, minors and cofactors, cofactor expansion, adjoint and the inverse formula." },
  { lesson: "Topic 4 ", file: "la_t4.mp4", title: "Lecture video — Topic 4: Eigenvalues and Eigenvectors", caption: "Eigenvalues, eigenvectors and matrix diagonalisation, with worked examples." },
  { lesson: "Topic 5 ", file: "la_t5.mp4", title: "Lecture video — Topic 5: Vector Spaces and Linear Mappings", caption: "Vector spaces, examples in R^n, matrices and functions, linear and non-linear mappings." },
  { lesson: "Topic 6 ", file: "calc_t6.mp4", title: "Lecture video — Topic 6: Functions, Exponential and Logarithmic Functions", caption: "Functions and model parameters, affine and linear functions, exponentials, logarithms and log transformations." },
  { lesson: "Topic 7 ", file: "calc_t7.mp4", title: "Lecture video — Topic 7: Derivatives, the Chain Rule and Marginal Effects", caption: "Limits, continuity, derivatives as local slopes, tangent lines, derivative rules and the chain rule." },
  { lesson: "Topic 8 ", file: "calc_t8.mp4", title: "Lecture video — Topic 8: Partial Derivatives and the Gradient", caption: "Functions of several variables, partial derivatives, the gradient, directional derivatives, model, parameters and loss." },
  { lesson: "Topic 9 ", file: "calc_t9.mp4", title: "Lecture video — Topic 9: Optimization and Gradient Descent", caption: "Objectives and minima, stationary points, gradient descent with a fixed rate, worked examples and the calculus behind model training." },
];

/** Bản gắn nguyên Part ở lần đầu: thay bằng các video theo Topic ở trên. */
const REPLACED = ["Lecture video — Linear Algebra (Part I)", "Lecture video — Calculus and Optimization (Part II)"];

function durationOf(filePath: string): number {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath], { encoding: "utf8" });
  const sec = Math.round(parseFloat(out));
  if (!Number.isFinite(sec) || sec <= 0) throw new Error(`cannot read duration: ${filePath}`);
  return sec;
}

async function uploadVideo(filePath: string, ownerId: string): Promise<string> {
  const buf = await readFile(filePath);
  if (buf.byteLength === 0) throw new Error(`empty file: ${filePath}`);
  if (buf.byteLength > MAX_VIDEO_BYTES) throw new Error(`too large (${buf.byteLength}B): ${filePath}`);
  const now = new Date();
  const filename = `${ownerId}-${now.getTime()}-${randomBytes(8).toString("hex")}.mp4`;
  const key = lessonVideoKey(now, filename);
  await storageFor(key).put(key.key, buf, "video/mp4");
  return `/api/lesson-media/videos/${filename}`;
}

/** Phụ đề WebVTT: tên tệp phải có dạng <tiền tố>-<ms>-<hex>.vtt để route transcripts tìm lại được thư mục theo tháng. */
async function uploadVtt(filePath: string, ownerId: string): Promise<string> {
  const buf = await readFile(filePath);
  if (buf.byteLength === 0 || !buf.subarray(0, 6).toString().startsWith("WEBVTT")) throw new Error(`not a WebVTT file: ${filePath}`);
  const now = new Date();
  const filename = `${ownerId}-${now.getTime()}-${randomBytes(8).toString("hex")}.vtt`;
  const key = lessonTranscriptKey(now, filename);
  await storageFor(key).put(key.key, buf, "text/plain; charset=utf-8");
  return `/api/lesson-media/transcripts/${filename}`;
}

/**
 * Đưa một khối lên đầu bài bằng SQL thuần: các khối còn lại lùi một nấc, thứ tự tương đối giữ nguyên.
 * Không dùng reorderContentItems vì nó đọc lại cả dòng — prod có loại nội dung (vocab_list) mới hơn Prisma client ở đây
 * nên đọc dòng đó là lỗi.
 */
async function moveToTop(lessonId: string, itemId: string): Promise<void> {
  await prisma.$transaction([
    prisma.$executeRaw`UPDATE "ContentItem" SET "orderIndex" = "orderIndex" + 1 WHERE "lessonId" = ${lessonId} AND id <> ${itemId}`,
    prisma.$executeRaw`UPDATE "ContentItem" SET "orderIndex" = 0 WHERE id = ${itemId}`,
  ]);
}

async function main() {
  const dir = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  const ri = process.argv.indexOf("--replace");
  const replaceTopics = new Set((ri >= 0 ? (process.argv[ri + 1] ?? "") : "").split(",").filter(Boolean).map((x) => `Topic ${x} `));
  if (!dir || dir.startsWith("--")) {
    console.error("usage: attach-mfds-videos.ts <videos-dir> [--dry-run]");
    process.exit(1);
  }
  for (const p of PLAN) for (const f of [p.file, p.file.replace(/\.mp4$/, ".vtt")]) if (!existsSync(join(dir, f))) throw new Error(`missing: ${f}`);

  const course = await prisma.course.findUnique({ where: { slug: COURSE_SLUG } });
  if (!course) throw new Error(`no course ${COURSE_SLUG}`);
  const owner = await prisma.courseInstructor.findFirst({ where: { courseId: course.id, role: "owner" }, select: { userId: true } });
  if (!owner) throw new Error("course has no owner");
  const actor = owner.userId;

  const lessons = await prisma.lesson.findMany({
    where: { module: { courseId: course.id } },
    // Chỉ đọc khối video: prod có thể chứa loại nội dung mới hơn bản client này (vd. vocab_list) mà Prisma không đọc được.
    select: { id: true, title: true, contentItems: { where: { type: "video" }, select: { id: true, type: true, orderIndex: true, payload: true } } },
  });

  let added = 0;
  for (const p of PLAN) {
    const hits = lessons.filter((l) => l.title.startsWith(p.lesson));
    if (hits.length !== 1) throw new Error(`expected 1 lesson for "${p.lesson}", found ${hits.length}`);
    const l = hits[0]!;
    const has = l.contentItems.some((c) => (c.payload as { title?: string }).title === p.title);
    const file = join(dir, p.file);
    if (has) {
      // Đã có từ lần chạy trước: chỉ bảo đảm nó nằm đầu bài.
      const mine = l.contentItems.find((c) => (c.payload as { title?: string }).title === p.title)!;
      if (replaceTopics.has(p.lesson)) {
        if (dryRun) console.log(`(dry-run) thay video "${l.title}" ← ${p.file}`);
        else {
          const durationSec = durationOf(file);
          const url = await uploadVideo(file, actor);
          const transcriptUrl = await uploadVtt(join(dir, p.file.replace(/\.mp4$/, ".vtt")), actor);
          await updateContentItem(actor, mine.id, { payload: { ...(mine.payload as Record<string, unknown>), url, durationSec, transcriptUrl } }, prisma);
          console.log(`↻ "${l.title}" ← ${p.file} (${durationSec}s) → ${url}`);
        }
        continue;
      }
      const first = await prisma.contentItem.aggregate({ where: { lessonId: l.id, id: { not: mine.id } }, _min: { orderIndex: true } });
      if ((first._min.orderIndex ?? 1) <= mine.orderIndex && mine.orderIndex !== 0) {
        await moveToTop(l.id, mine.id);
        console.log(`↑ "${l.title}": đưa video lên đầu bài`);
      } else console.log(`= "${l.title}": đã có video, đã ở đầu bài`);
      continue;
    }
    if (dryRun) {
      console.log(`(dry-run) "${l.title}" ← ${p.file} (${Math.round(durationOf(file) / 60)} phút)`);
      continue;
    }
    const durationSec = durationOf(file);
    const url = await uploadVideo(file, actor);
    const transcriptUrl = await uploadVtt(join(dir, p.file.replace(/\.mp4$/, ".vtt")), actor);
    const created = await createContentItem(actor, l.id, { type: "video", payload: { url, durationSec, title: p.title, caption: p.caption, transcriptUrl, captionLang: "en", captionLabel: "English" }, orderIndex: 999 }, prisma);
    await moveToTop(l.id, created.contentItemId);
    added++;
    console.log(`✔ "${l.title}" ← ${p.file} (${durationSec}s) → ${url}`);
  }
  // Gỡ video theo Part đã thay bằng video theo Topic.
  for (const l of lessons) {
    for (const c of l.contentItems) {
      if (c.type === "video" && REPLACED.includes((c.payload as { title?: string }).title ?? "")) {
        if (dryRun) console.log(`(dry-run) gỡ video cũ khỏi "${l.title}"`);
        else {
          await deleteContentItem(actor, c.id, prisma);
          console.log(`✘ gỡ video theo Part khỏi "${l.title}"`);
        }
      }
    }
  }
  console.log(dryRun ? "\nDry run — nothing written." : `\nĐã thêm ${added} video.`);
}

main()
  .catch((e) => {
    console.error(e, JSON.stringify((e as { details?: unknown }).details ?? (e as Record<string, unknown>), null, 1));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
