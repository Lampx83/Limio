/**
 * Nhập một bộ slide Limio-Live từ file JSON, đi qua đúng đường UI giảng viên đi
 * — createLiveDeck → updateLiveDeck (giao diện) → addLiveSlidesBulk — thay vì
 * INSERT tay. Slide "Nội dung" có tài nguyên được zod kiểm trước khi chạm DB
 * (cùng luật với route POST .../slides).
 *
 *   pnpm import:deck -- --file ./slide.json --owner gv@example.com --dry-run
 *   pnpm import:deck -- --file ./slide.json --owner gv@example.com
 *   pnpm import:deck:prod -- --file ./slide.json --owner gv@example.com
 *
 * Chạy vào production: mở đường hầm SSH tới Postgres như hướng dẫn đầu
 * import-course.ts, điền packages/db/.env.prod-import.
 *
 * Chỉ THÊM deck mới; không sửa hay xoá deck đã có. Trùng tiêu đề với deck của
 * cùng người thì dừng — muốn làm lại thì xoá deck cũ trong giao diện trước.
 *
 * Dạng file: { title, theme?, slides: [{ type, config, timerSeconds? }] }
 */

import { readFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";
import { z } from "zod";
import { addLiveSlidesBulk, createLiveDeck, updateLiveDeck } from "../src/live/decks";
import { validateContentPayload, type ContentTypeKey } from "../src/courses/contentSchemas";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const RESOURCE_TYPES = ["richtext", "markdown", "video", "pdf", "file", "external_link", "embed", "html_block"];
const SLIDE_TYPES = ["content", "quiz", "poll", "word_cloud", "collaborate_board", "whiteboard"] as const;

const DeckFile = z.object({
  title: z.string().min(1),
  theme: z.string().optional(),
  slides: z
    .array(
      z.object({
        type: z.enum(SLIDE_TYPES),
        config: z.record(z.unknown()),
        timerSeconds: z.number().int().positive().nullable().optional(),
      })
    )
    .min(1),
});

async function main() {
  const file = arg("file");
  const ownerEmail = arg("owner");
  const dryRun = process.argv.includes("--dry-run");
  if (!file || !ownerEmail) {
    console.error("Cần --file <slide.json> và --owner <email>");
    process.exit(1);
  }

  const parsed = DeckFile.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) {
    console.error("File không đúng dạng:", parsed.error.flatten());
    process.exit(1);
  }
  const deck = parsed.data;

  const problems: string[] = [];
  deck.slides.forEach((s, i) => {
    const n = `slide ${i + 1}`;
    const c = s.config as Record<string, any>;
    if (s.type === "content" && c.resource) {
      if (!RESOURCE_TYPES.includes(c.resource.type)) problems.push(`${n}: loại tài nguyên lạ`);
      else {
        try {
          validateContentPayload(c.resource.type as ContentTypeKey, c.resource.payload);
        } catch (e) {
          problems.push(`${n}: payload tài nguyên sai (${(e as Error).message.slice(0, 80)})`);
        }
      }
    }
    if ((s.type === "poll" || s.type === "quiz") && (!c.question || (c.options ?? []).length < 2)) {
      problems.push(`${n}: ${s.type} cần câu hỏi và ít nhất 2 đáp án`);
    }
    if (s.type === "word_cloud" && !c.prompt) problems.push(`${n}: word_cloud thiếu prompt`);
    if (s.type === "collaborate_board" && !c.prompt) problems.push(`${n}: bảng dán note thiếu prompt`);
  });

  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true, displayName: true } });
  if (!owner) problems.push(`Không có tài khoản nào với email ${ownerEmail}`);
  else {
    const dup = await prisma.liveDeck.findFirst({ where: { userId: owner.id, title: deck.title } });
    if (dup) problems.push(`Đã có deck trùng tiêu đề (${dup.id}). Xoá nó trong giao diện rồi chạy lại.`);
  }

  const byType: Record<string, number> = {};
  for (const s of deck.slides) byType[s.type] = (byType[s.type] ?? 0) + 1;
  console.log(`Deck: ${deck.title}`);
  console.log(`Chủ sở hữu: ${owner ? `${owner.displayName ?? ownerEmail} <${ownerEmail}>` : "(không tìm thấy)"}`);
  console.log(`Slide: ${deck.slides.length}`, byType);

  if (problems.length) {
    console.error("\nCó vấn đề, không ghi gì:");
    for (const p of problems) console.error(" -", p);
    process.exit(1);
  }
  if (dryRun) {
    console.log("\n--dry-run: hợp lệ, chưa ghi gì.");
    return;
  }

  const created = await createLiveDeck({ userId: owner!.id, title: deck.title }, prisma);
  if (deck.theme) await updateLiveDeck(created.id, owner!.id, { theme: deck.theme }, prisma);
  const slides = await addLiveSlidesBulk(
    created.id,
    owner!.id,
    deck.slides.map((s) => ({ type: s.type, config: s.config, timerSeconds: s.timerSeconds ?? null })),
    prisma
  );
  console.log(`\nĐã tạo deck ${created.id} với ${slides.length} slide.`);
  console.log(`Mở: /instructor/limio-live/${created.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
