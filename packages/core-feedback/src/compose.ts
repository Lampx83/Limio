/**
 * B11 — ghép nội dung phản hồi theo khung Hattie & Timperley (2007).
 *
 * Trước B11, body của một lượt feedback là nguyên văn **một** `FeedbackTemplate`
 * gắn theo misconception. Một mã như `uiux.principle-mixup` trải trên 12 câu hỏi
 * khác nhau, nên cùng một đoạn văn phải phục vụ cả 12 — buộc phải chung chung, và
 * khi nó chứa ví dụ cụ thể thì hoá ra nói chuyện của câu khác.
 *
 * Đây là trần của kiến trúc (một mã, một chuỗi, N câu hỏi), không phải lỗi viết
 * lách. Cách thoát là ghép lúc phát, trong đó phần giải thích lấy từ *chính câu
 * hỏi đó*.
 *
 * Ba câu hỏi của Hattie & Timperley, theo đúng thứ tự:
 *
 *   feed up      — mục tiêu là gì            → mục tiêu câu hỏi, hoặc tên bài
 *   feed back    — tôi đang ở đâu so với nó  → đã chọn gì / đúng là gì / nhầm ở đâu
 *   feed forward — bước tiếp theo            → bài nên xem lại
 *
 * Cấp độ `self` không bao giờ được phát: gọi tên để xưng hô thì được, gọi tên để
 * đánh giá con người thì không (Hattie: feedback cấp `self` có thể làm suy giảm
 * học tập). Lời chào nằm ở đầu trang kết quả, không nằm trong từng khối.
 *
 * Hàm thuần — test được không cần DB, và dùng lại được ở chỗ khác.
 */

export interface ComposeInput {
  /** Mục tiêu học tập của câu hỏi. Null ⇒ lùi về tên bài. */
  learningObjective: string | null;
  /** Tên bài học chứa câu hỏi, dùng làm proxy cho feed up. */
  lessonTitle: string | null;
  /**
   * Nhãn các phương án người học đã chọn (mcq/true_false). Rỗng với các loại
   * câu khác — mỗi loại có nước riêng nói "bạn đã làm gì" (`typedResponse`,
   * `orderedCorrectLabels`), matching thì không loại nào áp dụng được.
   */
  chosenLabels: string[];
  /** Nhãn các phương án đúng — mcq/true_false/fill_in đều đánh dấu `isCorrect`. */
  correctLabels: string[];
  /**
   * Chuỗi người học đã gõ, cho câu điền từ. Chấm bằng so khớp chuỗi
   * (`grading.ts` case "fill_in"), không phải chọn phương án, nên tách khỏi
   * `chosenLabels` — không mang rủi ro khớp giả như ordering.
   */
  typedResponse: string | null;
  /**
   * Thứ tự đúng cho câu sắp xếp, theo `orderIndex` — KHÔNG lấy từ `isCorrect`.
   * `grading.ts` case "ordering" chấm bằng so cả chuỗi với thứ tự chuẩn, nên
   * không phương án nào được đánh dấu `isCorrect=true` riêng lẻ; thiếu trường
   * này thì nước feed-back của câu ordering hoàn toàn im lặng.
   */
  orderedCorrectLabels: string[];
  /**
   * Tên ngắn của chỗ nhầm (`Misconception.name`), KHÔNG phải đoạn văn dùng
   * chung. Null khi không nhận diện được, hoặc khi lớp đang ở điều kiện đối
   * chứng của B10.
   */
  misconceptionName: string | null;
  /** Giải thích của chính câu hỏi — phần mang nội dung đặc thù nhất. */
  explanation: string | null;
  /** Nội dung template, chỉ dùng khi câu hỏi không có giải thích riêng. */
  templateBody: string | null;
  /** Tên các bài được gợi ý ôn lại. Rỗng ⇒ bỏ nước feed forward. */
  remediationLessonTitles: string[];
}

/** Câu cuối cùng khi không có gì để nói thêm — vẫn hơn là để trống. */
const FALLBACK = "Câu này bạn chưa đúng. Hãy đọc lại nội dung liên quan và thử lại.";

function quote(s: string): string {
  // Nhãn đáp án có thể dài; cắt cho câu văn còn đọc được.
  const t = s.trim().replace(/\s+/g, " ");
  return `“${t.length > 180 ? t.slice(0, 177) + "…" : t}”`;
}

function joinLabels(labels: string[]): string {
  const parts = labels.map(quote);
  if (parts.length <= 1) return parts[0] ?? "";
  return parts.slice(0, -1).join(", ") + " và " + parts[parts.length - 1];
}

/**
 * Dựng body cho một lượt feedback. Mọi nước đều tuỳ chọn: thiếu dữ liệu thì bỏ
 * nước đó chứ không bịa ra nội dung.
 */
export function composeFeedbackBody(input: ComposeInput): string {
  const moves: string[] = [];

  // ── feed up: mục tiêu là gì ───────────────────────────────────────────────
  // Mục tiêu do GV viết thì nói thẳng; không có thì lùi về tên bài, và khi đó
  // chỉ định vị chứ không dám gọi là "mục tiêu".
  if (input.learningObjective?.trim()) {
    moves.push(`Phần này nhắm tới: ${input.learningObjective.trim()}`);
  } else if (input.lessonTitle?.trim()) {
    moves.push(`Câu này thuộc ${quote(input.lessonTitle)}.`);
  }

  // ── feed back: tôi đang ở đâu ─────────────────────────────────────────────
  const chosen = input.chosenLabels.filter((s) => s.trim());
  const correct = input.correctLabels.filter((s) => s.trim());
  const ordered = input.orderedCorrectLabels.filter((s) => s.trim());
  const typed = input.typedResponse?.trim() || "";

  if (chosen.length > 0 && correct.length > 0) {
    moves.push(
      `Mình thấy bạn chọn ${joinLabels(chosen)}, trong khi đáp án đúng là ${joinLabels(correct)}.`,
    );
  } else if (typed && correct.length > 0) {
    // fill_in: chuỗi tự do, không phải chọn phương án — nêu đúng chữ đã gõ.
    moves.push(
      `Mình thấy bạn điền ${quote(typed)}, trong khi đáp án đúng là ${joinLabels(correct)}.`,
    );
  } else if (ordered.length > 0) {
    // ordering: không phương án nào tự nó "đúng/sai" — đúng ở chỗ thứ tự.
    moves.push(`Thứ tự đúng là: ${ordered.map(quote).join(" → ")}.`);
  } else if (correct.length > 0) {
    // matching: không nói được "bạn chọn gì", nhưng vẫn nêu được đáp án.
    moves.push(`Đáp án đúng là ${joinLabels(correct)}.`);
  }

  if (input.misconceptionName?.trim()) {
    moves.push(`Chỗ này dễ nhầm: ${input.misconceptionName.trim()}.`);
  }

  // Giải thích của chính câu hỏi là phần đặc thù nhất; template chỉ là lưới đỡ.
  const explanation = input.explanation?.trim() || input.templateBody?.trim() || "";
  if (explanation) moves.push(explanation);

  // ── feed forward: bước tiếp theo ──────────────────────────────────────────
  const lessons = input.remediationLessonTitles.filter((s) => s.trim());
  if (lessons.length === 1) {
    moves.push(`Bạn xem lại ${quote(lessons[0]!)} rồi thử lại nhé.`);
  } else if (lessons.length > 1) {
    moves.push(`Bạn xem lại ${joinLabels(lessons)} rồi thử lại nhé.`);
  }

  if (moves.length === 0) return FALLBACK;
  // Chỉ có mỗi feed up thì chưa nói được gì về bài làm — thêm câu chốt.
  if (
    moves.length === 1 &&
    !explanation &&
    chosen.length === 0 &&
    ordered.length === 0 &&
    !typed
  ) {
    moves.push(FALLBACK);
  }
  return moves.join("\n\n");
}
