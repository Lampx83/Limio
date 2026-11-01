/**
 * Dựng file nhập khoá «Toán 10 — slide tương tác» từ các bộ slide trong `src/content/decks/*.json`.
 *
 *   tsx scripts/build-deck-course.ts <manifest.json>
 *   pnpm import:course -- --file manifest.json --owner gv@example.com --dry-run
 *
 * Mỗi bài là một khối nhúng `/decks/<id>` (khung slide tương tác, xem `src/lib/slideDeck`); lời giảng của giảng viên ảo
 * là một đoạn cho mỗi bước `loiGiang.buoc` của mỗi slide, anchor `s<slide>b<bước>` để trình chiếu điều khiển khung theo giọng.
 */
import { writeFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { deckAnchor } from "../src/lib/narration/deckSync";
import { loadDeck } from "../src/lib/slideDeck/decks";
import { cleanNarration } from "../src/lib/smartdocConvert";

(globalThis as unknown as Record<string, unknown>).DOMParser = new JSDOM("").window.DOMParser;

const PERSONA = { xung: "thầy", ten: "Tiến Đạt" };

const LESSONS = [
  { id: "ham-bac-hai", tieuDe: "Hàm số bậc hai và đồ thị", moTa: "Parabol quanh ta, đỉnh, trục đối xứng, bảng biến thiên và bài toán thực tế.", phut: 85 },
  { id: "conic", tieuDe: "Ba đường conic", moTa: "Elip, hypebol, parabol: phương trình chính tắc và hình dạng.", phut: 25 },
  { id: "tam-giac", tieuDe: "Hệ thức lượng trong tam giác", moTa: "Định lí côsin, định lí sin và giải tam giác trong thực tế.", phut: 25 },
  { id: "toi-uu", tieuDe: "Hệ bất phương trình bậc nhất hai ẩn và tối ưu", moTa: "Miền nghiệm trên mặt phẳng toạ độ và bài toán tìm giá trị tốt nhất.", phut: 25 },
  { id: "xac-suat", tieuDe: "Xác suất cổ điển", moTa: "Không gian mẫu, biến cố và cách tính xác suất bằng định nghĩa cổ điển.", phut: 25 },
];

type Deck = { slides: { id: string; loiGiang?: { buoc?: string[] } }[] };

export function deckLecture(deck: Deck): { anchor: string; text: string }[] {
  const out: { anchor: string; text: string }[] = [];
  deck.slides.forEach((s, i) => {
    (s.loiGiang?.buoc ?? []).forEach((step, b) => {
      const text = cleanNarration([step], PERSONA);
      if (text) out.push({ anchor: deckAnchor(i, b), text });
    });
  });
  return out;
}

function main() {
  const out = process.argv[2];
  if (!out) {
    console.error("usage: build-deck-course.ts <manifest.json>");
    process.exit(1);
  }
  const lessons = LESSONS.map((meta) => {
    const deck = loadDeck(meta.id) as (Deck & { tieuDe?: string }) | null;
    if (!deck) throw new Error(`Thiếu bộ slide ${meta.id}`);
    const lecture = deckLecture(deck);
    console.log(`${meta.tieuDe}: ${deck.slides.length} slide, ${lecture.length} đoạn lời giảng`);
    return {
      title: meta.tieuDe,
      description: meta.moTa,
      body: `## Bài giảng tương tác\n\n${meta.moTa} Bấm «Nghe giảng» để học cùng giảng viên ảo: thầy giảng đến đâu, slide chạy đến đó; em có thể tự thao tác trên từng slide.`,
      durationMin: meta.phut,
      embeds: [{ url: `/decks/${meta.id}`, height: 720 }],
      lecture,
    };
  });
  const manifest = {
    course: {
      title: "Toán 10 — slide tương tác cùng giảng viên ảo",
      slug: "toan-10-slide-tuong-tac",
      description:
        "Năm bài Toán 10 (Chương trình GDPT 2018) dạng slide tương tác: kéo tham số xem đồ thị đổi, làm trắc nghiệm, ghép đôi ngay trên slide, " +
        "trong khi giảng viên ảo giảng từng bước.",
      language: "vi",
      level: "beginner" as const,
    },
    modules: [{ title: "Toán 10", lessons }],
  };
  writeFileSync(out, JSON.stringify(manifest, null, 2));
  console.log(`Đã ghi ${out}`);
}

main();
