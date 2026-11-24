/**
 * Gắn ảnh minh hoạ HSK vào các bài ĐANG CÓ của khoá, nhiều Chủ đề một lượt — chỉ CHÈN thêm `<figure>`, không xoá gì.
 * Họ hàng của `attach-hsk-images.ts` (một Chủ đề một lần) nhưng khớp với khoá HSK 1 dựng lại bằng `rebuild-course.ts`.
 *
 *   tsx --env-file=.env scripts/attach-hsk-scene-images.ts --course hsk-1-goc --plan plan.json --urls urls.json --owner gv@example.com [--dry-run]
 *
 * plan.json: [{ "module": 1, "lesson": "Bài khoá 1", "place": "scene" | "vocab" | "reading", "key": "u01-c1", "alt": "...", "caption": "..." }]
 *   - module: số Chủ đề (khớp tiêu đề "Chủ đề N ·").
 *   - lesson: tiền tố tiêu đề bài trong Chủ đề đó.
 *   - scene:   cuối khối richtext chứa mục 情景 (id="muc-tinh-huong"), ngay trước ô "Xem thêm" nếu có.
 *   - vocab:   cuối khối richtext chứa mục 生词 (id="muc-tu-moi"), tức ngay trên bảng từ.
 *   - reading: cuối khối richtext có tiêu đề 阅读 (bài Bài tập tổng hợp), ngay trên đoạn đọc.
 * urls.json: tên ảnh → URL do `hsk-upload-images.ts` in ra.
 *
 * Idempotent: khối nào đã chứa đúng URL ảnh thì bỏ qua. Không tìm được chỗ chèn thì dừng và báo, không ghi gì.
 */
import { readFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";
import { updateContentItem } from "@feedbackme/core-lms";

type Op = { module: number; lesson: string; place: "scene" | "vocab" | "reading"; key: string; alt: string; caption?: string };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Cùng kiểu với hình `![alt](url "chú thích")` của import-course.
function figure(url: string, alt: string, caption?: string): string {
  return (
    `<figure style="margin:1.2rem 0"><img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" ` +
    `style="max-width:100%;max-height:70vh;width:auto;height:auto;border:1px solid rgba(127,127,127,0.32);` +
    `border-radius:.5rem;display:block;margin-inline:auto">` +
    (caption
      ? `<figcaption style="font-size:1rem;color:rgba(127,127,127,0.95);line-height:1.6;margin:.45rem 0 0">${esc(caption)}</figcaption>`
      : "") +
    `</figure>`
  );
}

function insert(html: string, op: Op, url: string): string | null {
  const fig = figure(url, op.alt, op.caption);
  if (op.place === "vocab") return html.includes('id="muc-tu-moi"') ? html + fig : null;
  if (op.place === "reading") return html.includes("阅读") && !html.includes("Mục tiêu bài học") ? html + fig : null;
  const m = /<h2[^>]*id="muc-tinh-huong"/.exec(html);
  if (!m) return null;
  const d = html.indexOf("<details", m.index);
  return d >= 0 ? html.slice(0, d) + fig + html.slice(d) : html + fig;
}

async function main() {
  const slug = arg("course");
  const planFile = arg("plan");
  const urlsFile = arg("urls");
  const owner = arg("owner");
  const dryRun = process.argv.includes("--dry-run");
  if (!slug || !planFile || !urlsFile || !owner) {
    console.error("usage: attach-hsk-scene-images.ts --course <slug> --plan plan.json --urls urls.json --owner <email> [--dry-run]");
    process.exit(1);
  }
  const plan: Op[] = JSON.parse(readFileSync(planFile, "utf8"));
  const urls: Record<string, string> = JSON.parse(readFileSync(urlsFile, "utf8"));
  const actor = await prisma.user.findUnique({ where: { email: owner }, select: { id: true } });
  if (!actor) throw new Error(`no user ${owner}`);
  const course = await prisma.course.findUnique({ where: { slug }, select: { id: true } });
  if (!course) throw new Error(`no course ${slug}`);

  // Chỉ đọc khối richtext: prod có loại nội dung mới hơn client này (vd. exam_practice) mà Prisma không đọc được.
  const modules = await prisma.module.findMany({
    where: { courseId: course.id },
    select: {
      title: true,
      lessons: {
        select: { id: true, title: true, contentItems: { where: { type: "richtext" }, orderBy: { orderIndex: "asc" }, select: { id: true, payload: true } } },
      },
    },
  });
  console.log(`${slug}: ${modules.length} chủ đề${dryRun ? " (dry-run)" : ""}`);

  const edits = new Map<string, { html: string; notes: string[] }>();
  for (const op of plan) {
    const url = urls[op.key];
    if (!url) throw new Error(`thiếu URL cho ảnh "${op.key}" trong ${urlsFile}`);
    const mod = modules.find((m) => m.title.startsWith(`Chủ đề ${op.module} ·`));
    if (!mod) throw new Error(`không có "Chủ đề ${op.module} ·"`);
    const l = mod.lessons.find((x) => x.title.startsWith(op.lesson));
    if (!l) throw new Error(`không có bài "${op.lesson}…" trong ${mod.title}`);
    let done = false;
    for (const ci of l.contentItems) {
      const cur = edits.get(ci.id)?.html ?? String((ci.payload as { html?: string }).html ?? "");
      if (cur.includes(url)) {
        console.log(`= Chủ đề ${op.module} · ${l.title.slice(0, 20)} · ${op.key}: đã có`);
        done = true;
        break;
      }
      const next = insert(cur, op, url);
      if (next === null) continue;
      const e = edits.get(ci.id) ?? { html: cur, notes: [] };
      e.html = next;
      e.notes.push(`${op.key} (${op.place})`);
      edits.set(ci.id, e);
      done = true;
      break;
    }
    if (!done) throw new Error(`không tìm được chỗ chèn ${op.key} (${op.place}) ở "${mod.title.slice(0, 20)} › ${l.title}"`);
  }

  for (const [id, e] of edits) {
    if (dryRun) console.log(`(dry-run) sửa khối ${id}: ${e.notes.join(", ")}`);
    else {
      await updateContentItem(actor.id, id, { payload: { html: e.html } }, prisma);
      console.log(`✔ sửa khối ${id}: ${e.notes.join(", ")}`);
    }
  }
  console.log(dryRun ? "\nDry run — chưa ghi gì." : "\nXong.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
