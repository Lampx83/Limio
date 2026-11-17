/**
 * Gắn nội dung bổ sung của khung "小语讲堂" (cụm khoá + pinyin, nghĩa, cách dùng, lưu ý, pinyin và dịch từng ví dụ) vào khối ngữ pháp của từng bài HSK:
 * `ContentItem.payload.hskGrammar[số điểm]`. Giao diện bài HSK đọc trường này (apps/web/src/lib/hskGrammar.ts); khối không có thì vẫn hiện nội dung sách.
 *   pnpm --filter @feedbackme/core-lms exec tsx scripts/apply-grammar-content.ts --file ~/Documents/Limio/hsk3-lesson-1/vi3/grammar-content-vi.json --course hsk-3-bai-1-8-vi [--dry-run]
 * Tệp dữ liệu: { "Bài 1|Bài khoá 1|1": { examples:[{reading,vi}], phrases, meaning, usage, note }, … } — khoá = "<module>|<bài>|<số điểm>", khớp theo tên đã đặt trong khoá.
 * Chạy với DATABASE_URL của môi trường cần ghi (dev mặc định; prod qua .env.prod-import như các script nhập khoá). Ghi lại được nhiều lần (ghi đè hskGrammar).
 */
import { readFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

type Point = { examples?: Array<{ reading?: string; vi?: string }>; phrases?: unknown; meaning?: unknown; usage?: unknown; note?: unknown };

async function main() {
  const file = arg("--file");
  const slug = arg("--course");
  if (!file || !slug) throw new Error("Cần --file <json> và --course <slug>");
  const dry = process.argv.includes("--dry-run");
  const data = JSON.parse(readFileSync(file.replace(/^~/, process.env.HOME ?? ""), "utf8")) as Record<string, Point>;
  const lessons = await prisma.lesson.findMany({
    where: { module: { course: { slug } } },
    include: { module: { select: { title: true } }, contentItems: true },
  });
  if (!lessons.length) throw new Error(`Không thấy bài nào của khoá "${slug}"`);
  const used = new Set<string>();
  let items = 0;
  let points = 0;
  for (const l of lessons) {
    const mod = l.module.title.split(" · ")[0]!.trim();
    const les = l.title.split(" · ")[0]!.trim();
    const item = l.contentItems.find((c) => c.type === "richtext" && /小语讲堂/.test((c.payload as { html?: string } | null)?.html ?? ""));
    if (!item) continue;
    const keys = Object.keys(data).filter((k) => k.startsWith(`${mod}|${les}|`));
    if (!keys.length) continue;
    const grammar: Record<string, unknown> = {};
    for (const k of keys) {
      const p = data[k]!;
      grammar[k.split("|")[2]!] = {
        phrases: p.phrases ?? [],
        meaning: p.meaning ?? null,
        usage: p.usage ?? null,
        note: p.note ?? null,
        examples: (p.examples ?? []).map((e) => ({ reading: e.reading ?? "", vi: e.vi ?? "" })),
      };
      used.add(k);
      points += 1;
    }
    items += 1;
    if (!dry) await prisma.contentItem.update({ where: { id: item.id }, data: { payload: { ...(item.payload as object), hskGrammar: grammar } as never } });
  }
  const missing = Object.keys(data).filter((k) => !used.has(k));
  console.log(`${dry ? "[thử, chưa ghi] " : ""}${items} khối ngữ pháp, ${points}/${Object.keys(data).length} điểm đã khớp.`);
  if (missing.length) console.warn(`⚠ Không khớp được ${missing.length} điểm: ${missing.slice(0, 6).join(" · ")}${missing.length > 6 ? " …" : ""}`);
}

main().finally(() => prisma.$disconnect());
