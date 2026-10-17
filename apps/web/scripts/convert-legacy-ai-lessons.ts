/**
 * Chuyển các khối Văn bản "Định dạng bằng AI" kiểu cũ (màu viết thẳng vào thẻ, bị khoá
 * không sửa tay được) sang dạng khối mới — tiêu chí S5 trong docs/tieu-chi/bai-hoc-tu-tai-lieu.md.
 *
 *   tsx scripts/convert-legacy-ai-lessons.ts            # chạy thử: chỉ báo cáo, không ghi gì
 *   tsx scripts/convert-legacy-ai-lessons.ts --apply    # chuyển thật
 *
 * Bài chỉ được chuyển khi không mất gì (cùng chữ, cùng ảnh, trình soạn mở không mất gì —
 * xem src/lib/legacyLessonConvert.ts). Bài không đạt thì để nguyên và được liệt kê kèm lý
 * do. Mỗi bài chuyển: bản cũ lưu vào lịch sử (before_convert), ghi sự kiện
 * lesson.content.converted (via: "script"), tất cả trong một transaction cho từng bài.
 * Chạy lại an toàn: bài đã chuyển không còn dấu hiệu kiểu cũ nên bị bỏ qua.
 */
import { JSDOM } from "jsdom";
import type { Prisma } from "@feedbackme/db";

// Hàm chuyển cần DOM thật (DOMParser + trình soạn TipTap) — dựng bằng jsdom trước khi nạp.
const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as unknown as Record<string, unknown>;
for (const k of ["window", "document", "DOMParser", "Node", "HTMLElement", "Element", "NodeFilter", "MutationObserver", "getComputedStyle"]) {
  g[k] = k === "window" ? dom.window : (dom.window as unknown as Record<string, unknown>)[k];
}
if (!g.navigator) g.navigator = dom.window.navigator;

async function main() {
  const apply = process.argv.includes("--apply");
  const { prisma } = await import("@feedbackme/db");
  const { recordContentVersion, emitEvent } = await import("@feedbackme/core-lms");
  const { LearningEventType } = await import("@feedbackme/shared-types");
  const { convertLegacyAiHtml, looksLegacyAi } = await import("../src/lib/legacyLessonConvert");

  const items = await prisma.contentItem.findMany({
    where: { type: "richtext" },
    select: {
      id: true,
      payload: true,
      lesson: {
        select: {
          title: true,
          module: {
            select: {
              courseId: true,
              course: { select: { title: true, instructors: { where: { role: "owner" }, select: { userId: true }, take: 1 } } },
            },
          },
        },
      },
    },
  });
  const candidates = items.filter((i) => {
    const p = i.payload as { html?: unknown; look?: unknown };
    return typeof p.html === "string" && !p.look && looksLegacyAi(p.html);
  });

  let ok = 0;
  const failed: Array<{ id: string; where: string; reason: string }> = [];
  for (const item of candidates) {
    const html = (item.payload as { html: string }).html;
    const r = convertLegacyAiHtml(html);
    const where = `${item.lesson.module.course.title} › ${item.lesson.title}`;
    if (!r.ok) {
      failed.push({ id: item.id, where, reason: r.reason });
      continue;
    }
    ok++;
    if (!apply) continue;
    // Sự kiện cần một người; việc chạy hàng loạt ghi dưới tên chủ khoá.
    const actor = item.lesson.module.course.instructors[0]?.userId ?? null;
    await prisma.$transaction(async (tx) => {
      await recordContentVersion(tx, { id: item.id, payload: item.payload }, "before_convert", null);
      await tx.contentItem.update({
        where: { id: item.id },
        data: { payload: { ...(item.payload as object), html: r.html, look: r.look } as Prisma.InputJsonValue },
      });
      if (actor) {
        await emitEvent(actor, LearningEventType.LessonContentConverted, { contentItemId: item.id, via: "script" }, { courseId: item.lesson.module.courseId }, tx);
      }
    });
  }

  console.log(`${apply ? "ĐÃ CHUYỂN" : "CHẠY THỬ (chưa ghi gì)"}`);
  console.log(`Khối Văn bản kiểu cũ tìm thấy: ${candidates.length}`);
  console.log(`  chuyển được: ${ok}`);
  console.log(`  để nguyên:   ${failed.length}`);
  for (const f of failed) console.log(`    - ${f.where} (${f.id}): ${f.reason}`);
  if (!apply && ok > 0) console.log("Chạy lại với --apply để chuyển thật.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
