import { EnglishMarkupError, parseEnglishSpans } from "@feedbackme/core-lms";
import { cleanNarration } from "../smartdocConvert";
import { deckAnchor } from "./deckSync";

/**
 * Lời giảng của một bộ slide thành các đoạn `{ anchor, text }`, mỗi bước `loiGiang.buoc` một đoạn (anchor `s<slide>b<bước>`).
 * Đoạn tiếng Anh `[en: …]` được giữ nguyên trong `text` để bước tạo giọng đọc bằng giọng Anh
 * (docs/tieu-chi/slide-giang-song-ngu.md). Thẻ sai cú pháp làm dựng bài lỗi ngay, kèm vị trí slide và bước.
 */
export interface DeckLectureInput {
  slides: { id?: string; loiGiang?: { buoc?: string[] } }[];
}

export function buildDeckLecture(deck: DeckLectureInput, persona: { xung: string; ten: string }): { anchor: string; text: string }[] {
  const out: { anchor: string; text: string }[] = [];
  deck.slides.forEach((s, i) => {
    (s.loiGiang?.buoc ?? []).forEach((step, b) => {
      const text = cleanNarration([step], persona);
      if (!text) return;
      try {
        parseEnglishSpans(text);
      } catch (e) {
        if (e instanceof EnglishMarkupError) throw new Error(`Slide ${i + 1} (${s.id ?? "?"}), bước ${b + 1}: thẻ [en: …] ${VI[e.code]}`);
        throw e;
      }
      out.push({ anchor: deckAnchor(i, b), text });
    });
  });
  return out;
}

const VI: Record<EnglishMarkupError["code"], string> = {
  unclosed: "thiếu dấu ] đóng",
  empty: "đang rỗng",
  nested: "bị lồng nhau hoặc chứa dấu [",
};
