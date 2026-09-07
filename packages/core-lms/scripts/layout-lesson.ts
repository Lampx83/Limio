/**
 * Dựng lại toàn bộ khối nội dung của MỘT bài theo đúng bố cục mong muốn:
 *
 *   mục tiêu bài học → video mở bài → các mục thân bài, video minh hoạ chèn
 *   giữa → tổng kết
 *
 *   pnpm layout:lesson -- --file khoa.json --lesson "Bài 1.1" --owner gv@example.com \
 *     --video "0|URL|Tiêu đề|Mô tả" --video "3|URL|Tiêu đề|Mô tả" --dry-run
 *
 * `--video <vị trí>|<url>|<tiêu đề>|<mô tả>` — vị trí 0 nghĩa là ngay sau khối
 * mục tiêu; vị trí N nghĩa là sau khối thứ N. Lặp được. Dùng dấu `|` chứ không
 * phải `:` vì tiêu đề video hay có sẵn dấu hai chấm (ví dụ "3:41").
 *
 * Vì sao dựng lại thay vì chèn thêm: thứ tự khối là thứ người học đọc, mà
 * chèn từng cái rồi sắp lại bằng tay thì mỗi lần chạy ra một kết quả khác.
 * Script xoá sạch khối cũ của bài rồi tạo lại theo manifest — nội dung vẫn là
 * nội dung trong manifest, nên không có gì bị mất ngoài thứ tự cũ.
 *
 * Ghi chú của người học (`Note.contentItemId`) trỏ tới khối bị xoá sẽ được đặt
 * null chứ không mất — xem `onDelete: SetNull` trong schema. Chỉ chạy trên
 * khoá còn nháp hoặc khi đã chấp nhận điều đó.
 */
import { readFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";
import { createContentItem, deleteContentItem } from "../src/courses/contents";
import { Manifest, renderLessonBlocks } from "./import-course";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function args(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => {
    if (a === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1]!);
  });
  return out;
}


/**
 * Đưa khối tổng kết lên NGAY TRƯỚC mục luyện tập.
 *
 * `renderLessonBlocks` đẩy tổng kết xuống cuối; khi thân bài được cắt theo mục
 * thì tổng kết rơi ra sau cả phần luyện tập và phần nguồn tham khảo — chỗ
 * không ai còn đọc. Quy ước của khoá là đọc xong nội dung thì tới tổng kết,
 * rồi mới tới bài tập.
 */
function reorderSummaryBeforePractice(blocks: string[]): string[] {
  const last = blocks[blocks.length - 1];
  if (!last || !last.includes("Tổng kết bài học")) return blocks;
  const rest = blocks.slice(0, -1);
  const practice = rest.findIndex((b) => b.includes('<h2 id="muc-luyen-tap'));
  if (practice < 0) return blocks;
  return [...rest.slice(0, practice), last, ...rest.slice(practice)];
}

type VideoSpec = { at: number; url: string; title?: string; caption?: string };

/** "3|https://…|Tiêu đề|Mô tả" */
function parseVideo(raw: string): VideoSpec {
  const [atRaw, url, title, ...rest] = raw.split("|");
  const at = Number(atRaw);
  if (Number.isNaN(at) || !url) throw new Error(`--video sai định dạng: ${raw}`);
  return { at, url, title: title || undefined, caption: rest.join("|") || undefined };
}

async function main() {
  const file = arg("file");
  const lessonKey = arg("lesson");
  const ownerEmail = arg("owner");
  const dryRun = process.argv.includes("--dry-run");
  const videos = args("video").map(parseVideo);
  if (!file || !lessonKey || !ownerEmail) {
    console.error("Thiếu tham số: --file --lesson --owner [--video <at>:<url>:<title>:<caption>] [--dry-run]");
    process.exit(1);
  }

  const manifest = Manifest.parse(JSON.parse(readFileSync(file, "utf8")));
  const specs = manifest.modules.flatMap((m) => m.lessons).filter((l) => l.title.includes(lessonKey));
  if (specs.length !== 1) throw new Error(`Khớp ${specs.length} bài trong manifest với "${lessonKey}"`);
  const spec = specs[0]!;
  const blocks = reorderSummaryBeforePractice(renderLessonBlocks(spec));

  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  if (!owner) throw new Error(`Không có tài khoản ${ownerEmail}`);
  const lessons = await prisma.lesson.findMany({
    where: { title: { contains: lessonKey }, module: { course: { slug: manifest.course.slug } } },
    select: { id: true, title: true, contentItems: { select: { id: true, type: true }, orderBy: { orderIndex: "asc" } } },
  });
  if (lessons.length !== 1) throw new Error(`Khớp ${lessons.length} bài trên hệ thống với "${lessonKey}"`);
  const lesson = lessons[0]!;

  // Bố cục cuối cùng: khối[0] là mục tiêu, rồi chèn video theo vị trí.
  type Item = { kind: "richtext"; html: string } | { kind: "video"; v: VideoSpec };
  const layout: Item[] = [];
  blocks.forEach((html, i) => {
    layout.push({ kind: "richtext", html });
    for (const v of videos.filter((x) => x.at === i)) layout.push({ kind: "video", v });
  });
  for (const v of videos.filter((x) => x.at >= blocks.length)) layout.push({ kind: "video", v });

  console.log(`${lesson.title}`);
  console.log(`  cũ: ${lesson.contentItems.map((c) => c.type).join(", ") || "(trống)"}`);
  console.log(`  mới:`);
  layout.forEach((it, i) =>
    console.log(
      `    ${String(i).padStart(2)} ${it.kind === "video" ? `video · ${it.v.title ?? it.v.url}` : `richtext (${it.html.length} ký tự)`}`,
    ),
  );
  if (dryRun) {
    console.log("\n[dry-run] Không ghi gì.");
    return;
  }

  for (const c of lesson.contentItems) await deleteContentItem(owner.id, c.id);
  for (const [i, it] of layout.entries()) {
    if (it.kind === "richtext") {
      await createContentItem(owner.id, lesson.id, { type: "richtext", orderIndex: i, payload: { html: it.html } });
    } else {
      await createContentItem(owner.id, lesson.id, {
        type: "video",
        orderIndex: i,
        payload: {
          url: it.v.url,
          ...(it.v.title ? { title: it.v.title } : {}),
          ...(it.v.caption ? { caption: it.v.caption } : {}),
        },
      });
    }
  }
  console.log(`\n✔ Đã dựng lại ${layout.length} khối.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
