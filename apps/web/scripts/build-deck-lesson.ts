/**
 * Dựng manifest MỘT bài slide `/decks/<id>` để nạp vào khoá có sẵn bằng `update-lesson.ts` (không tạo khoá mới).
 *
 *   tsx scripts/build-deck-lesson.ts --deck passive-causative --slug speakout-intermediate-plus \
 *     --module "Unit 1 · Lifestyles" --title "1.1 Grammar · Slide có giảng viên ảo" --out lesson.json
 *   pnpm --filter @feedbackme/core-lms update:lesson -- --file lesson.json --owner gv@example.com --lesson "Slide có giảng viên ảo" --create --dry-run
 *
 * Giảng viên (xưng hô, tên) lấy từ `nguoiGiang.macDinh` của chính bộ slide; lời giảng có thể chứa `[en: …]`
 * (docs/tieu-chi/slide-giang-song-ngu.md). Quiz cuối bài nạp bằng `--quiz <file.json>` (không bắt buộc).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { buildDeckLecture } from "../src/lib/narration/deckLecture";
import { loadDeck } from "../src/lib/slideDeck/decks";

(globalThis as unknown as Record<string, unknown>).DOMParser = new JSDOM("").window.DOMParser;

const CHARS_PER_MINUTE = 1165;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const need = (name: string): string => {
  const v = arg(name);
  if (!v) {
    console.error(`Thiếu --${name}`);
    process.exit(1);
  }
  return v;
};

const deckId = need("deck");
const deck = loadDeck(deckId) as (ReturnType<typeof loadDeck> & { nguoiGiang?: { macDinh?: string; dsGiangVien?: { ma: string; ten: string; xung: string }[] } }) | null;
if (!deck) throw new Error(`Thiếu bộ slide ${deckId}`);
const gv = deck.nguoiGiang?.dsGiangVien?.find((g) => g.ma === deck.nguoiGiang?.macDinh) ?? deck.nguoiGiang?.dsGiangVien?.[0];
if (!gv) throw new Error("Bộ slide chưa khai báo nguoiGiang.dsGiangVien");

// Quiz cuối bài (tuỳ chọn): file { quiz, misconceptions, feedbackTemplates } — xem docs/hoc-lieu/speakout-grammar-slide/quiz.json.
const quizFile = arg("quiz");
const quizPack = quizFile
  ? (JSON.parse(readFileSync(quizFile, "utf8")) as { quiz: unknown; misconceptions?: unknown[]; feedbackTemplates?: unknown[] })
  : null;

const lecture = buildDeckLecture(deck, { xung: gv.xung, ten: gv.ten });
const chars = lecture.reduce((n, s) => n + s.text.length, 0);
const manifest = {
  course: {
    title: arg("course-title") ?? "Khoá có bài slide",
    // Bắt buộc theo Manifest; update-lesson chỉ dùng `slug` để tìm khoá và không ghi đè mô tả khoá đã có.
    description: arg("course-description") ?? deck.tieuDe,
    slug: need("slug"),
    language: arg("language") ?? "en",
    level: "intermediate" as const,
  },
  ...(quizPack?.misconceptions ? { misconceptions: quizPack.misconceptions } : {}),
  ...(quizPack?.feedbackTemplates ? { feedbackTemplates: quizPack.feedbackTemplates } : {}),
  modules: [
    {
      title: need("module"),
      lessons: [
        {
          title: need("title"),
          description: arg("description") ?? deck.tieuDe,
          // Không có `body`: màn hình bìa là toàn bộ phần mở đầu của bài (docs/tieu-chi/bai-slide-man-hinh-bia.md).
          durationMin: Math.max(1, Math.round(chars / CHARS_PER_MINUTE)),
          embeds: [{ url: `/decks/${deckId}`, height: 720 }],
          lecture,
          ...(quizPack ? { quiz: quizPack.quiz } : {}),
        },
      ],
    },
  ],
};
writeFileSync(need("out"), JSON.stringify(manifest, null, 2));
console.log(`${deckId}: ${deck.slides.length} slide, ${lecture.length} đoạn lời giảng, ${chars} ký tự (~${manifest.modules[0]!.lessons[0]!.durationMin} phút), giảng viên ${gv.ten} (${gv.xung})`);
