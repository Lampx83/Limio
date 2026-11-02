/**
 * In lời giảng của một bộ slide (`src/content/decks/<id>.json`) ra tệp JSON để nhập cùng bài học: mỗi bước `loiGiang.buoc`
 * là một đoạn, anchor `s<slide>b<bước>`. Khoá khác `toan-10-slide-tuong-tac` dùng script này thay cho build-deck-course.
 *
 *   tsx scripts/build-deck-lecture.ts <id> <out.json> [xưng] [tên]
 */
import { writeFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { deckAnchor } from "../src/lib/narration/deckSync";
import { loadDeck } from "../src/lib/slideDeck/decks";
import { cleanNarration } from "../src/lib/smartdocConvert";

(globalThis as unknown as Record<string, unknown>).DOMParser = new JSDOM("").window.DOMParser;

const [id, out, xung = "thầy", ten = "Tiến Đạt"] = process.argv.slice(2);
if (!id || !out) {
  console.error("usage: build-deck-lecture.ts <id> <out.json> [xưng] [tên]");
  process.exit(1);
}
const deck = loadDeck(id);
if (!deck) throw new Error(`Thiếu bộ slide ${id}`);

const lecture = deck.slides.flatMap((s, i) =>
  (s.loiGiang?.buoc ?? []).flatMap((step, b) => {
    const text = cleanNarration([step], { xung, ten });
    return text ? [{ anchor: deckAnchor(i, b), text }] : [];
  }),
);
writeFileSync(out, JSON.stringify(lecture, null, 2) + "\n");
console.log(`${id}: ${deck.slides.length} slide, ${lecture.length} đoạn lời giảng, ${lecture.reduce((n, s) => n + s.text.length, 0)} ký tự`);
