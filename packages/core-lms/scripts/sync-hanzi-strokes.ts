/**
 * Chép dữ liệu nét viết chữ Hán (cho nút "Cách viết" của thẻ từ mới) từ gói `hanzi-writer-data` vào apps/web/public/hanzi/<chữ>.json,
 * chỉ các chữ thật sự xuất hiện trong bài của khoá tiếng Trung (Course.language = "zh") — cả gói nặng ~47 MB, không nhúng hết.
 *   node --env-file=../db/.env --import tsx ./scripts/sync-hanzi-strokes.ts --data <thư mục hanzi-writer-data> [--out <thư mục>] [--dry-run]
 * Thêm khoá tiếng Trung mới ⇒ chạy lại (idempotent, chỉ thêm). Chữ không có trong gói thì in ra; nút "Cách viết" tự ẩn với từ có chữ thiếu dữ liệu.
 * Dữ liệu nét: Make Me a Hanzi (Arphic Public License) — ghi nguồn ở tài liệu tham khảo của khoá.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { prisma } from "@feedbackme/db";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const HAN = /[㐀-䶿一-鿿]/g;

async function main() {
  const data = arg("--data");
  if (!data || !existsSync(data)) throw new Error("Thiếu --data <thư mục hanzi-writer-data>");
  const out = resolve(arg("--out") ?? join(process.cwd(), "../../apps/web/public/hanzi"));
  const items = await prisma.contentItem.findMany({
    where: { lesson: { module: { course: { language: "zh" } } } },
    select: { payload: true },
  });
  const chars = new Set<string>();
  for (const it of items) for (const m of JSON.stringify(it.payload).match(HAN) ?? []) chars.add(m);
  const have = new Set(readdirSync(data).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)));
  const missing = [...chars].filter((c) => !have.has(c));
  const copy = [...chars].filter((c) => have.has(c));
  console.log(`${items.length} khối nội dung, ${chars.size} chữ Hán khác nhau, ${copy.length} có dữ liệu nét${missing.length ? `, THIẾU: ${missing.join("")}` : ""}`);
  if (process.argv.includes("--dry-run")) return;
  mkdirSync(out, { recursive: true });
  for (const c of copy) copyFileSync(join(data, `${c}.json`), join(out, `${c}.json`));
  console.log(`Đã chép vào ${out}`);
}

main().finally(() => prisma.$disconnect());
