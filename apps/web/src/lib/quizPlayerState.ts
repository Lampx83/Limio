/**
 * Logic thuần của màn làm quiz (QuizPlayer): trạng thái từng câu, lời nhắc
 * trước khi nộp, dòng báo "đã lưu".
 *
 * Tách ra khỏi component để kiểm thử được mà không cần dựng giao diện. Mọi
 * chuỗi ở đây là chuỗi người học đọc, nên viết thành câu đủ ý.
 */

/** done = đã trả lời và (nếu bắt buộc) đã chọn độ tự tin; câu này được lưu và tính điểm. */
import { translate, type TParams, type UiLang } from "@/lib/i18n/core";
import { EN, VI, type MessageKey } from "@/lib/i18n/dict";

const tr = (lang: UiLang, key: MessageKey, params?: TParams) => translate(VI, EN, lang, key, params);

export type QuestionStatus = "done" | "needs-confidence" | "empty";

export function questionStatus(input: {
  hasResponse: boolean;
  confidence: number | null;
  requireConfidence: boolean;
}): QuestionStatus {
  if (!input.hasResponse) return "empty";
  if (input.requireConfidence && input.confidence === null) return "needs-confidence";
  return "done";
}

/** [3] → "3"; [3, 5] → "3 và 5"; [3, 5, 7] → "3, 5 và 7" (en: "3 and 5"). */
export function joinNumbers(nums: number[], lang: UiLang = "vi"): string {
  if (nums.length === 0) return "";
  if (nums.length === 1) return String(nums[0]);
  return tr(lang, "practice.quiz.joinAnd", { list: nums.slice(0, -1).join(", "), last: nums[nums.length - 1]! });
}

/**
 * Nội dung hộp xác nhận trước khi nộp. Trả về null khi không còn gì cần nhắc,
 * để người học nộp thẳng.
 *
 * Gọi tên đúng số câu thay vì chỉ nói "còn N câu": người đang làm dở một bài
 * 30 câu không tìm lại được câu nào bị thiếu bằng một con số.
 */
export function submitWarning(input: {
  empty: number[];
  needsConfidence: number[];
  flagged: number[];
}, lang: UiLang = "vi"): string | null {
  const { empty, needsConfidence, flagged } = input;
  if (empty.length === 0 && needsConfidence.length === 0 && flagged.length === 0) return null;

  const lines: string[] = [];
  if (empty.length > 0) {
    lines.push(tr(lang, "practice.quiz.warn.empty", { nums: joinNumbers(empty, lang) }));
  }
  if (needsConfidence.length > 0) {
    lines.push(tr(lang, "practice.quiz.warn.needsConfidence", { nums: joinNumbers(needsConfidence, lang) }));
  }
  if (flagged.length > 0) {
    lines.push(tr(lang, "practice.quiz.warn.flagged", { nums: joinNumbers(flagged, lang) }));
  }
  return tr(lang, "practice.quiz.warn.submit", { lines: lines.join("\n") });
}

/**
 * Lời nhắc khi rời trang mà còn câu chưa được lưu lên máy chủ (thiếu số sao, mất mạng,
 * hoặc vừa chọn xong chưa kịp lưu). Null nếu mọi câu đã chọn đều đã lưu: lượt làm bài
 * vẫn còn, người học vào lại là làm tiếp.
 */
export function leaveWarning(unsavedNumbers: number[], lang: UiLang = "vi"): string | null {
  if (unsavedNumbers.length === 0) return null;
  return tr(lang, unsavedNumbers.length === 1 ? "practice.quiz.warn.leaveOne" : "practice.quiz.warn.leaveMany", {
    nums: joinNumbers(unsavedNumbers, lang),
  });
}

/** Chữ ký của một đáp án (nội dung + độ tự tin), để biết câu nào đã lưu đúng bản đang hiện. */
export function answerSignature(response: unknown, confidence: number | null): string {
  return JSON.stringify([response ?? null, confidence ?? null]);
}

export type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error" };

/**
 * Dòng trạng thái lưu bài. `formatClock` do nơi gọi truyền vào (giờ Việt Nam) để hàm
 * này không phụ thuộc múi giờ của máy chạy kiểm thử.
 */
export function saveStatusText(
  state: SaveState,
  unsavedCount: number,
  formatClock: (ms: number) => string,
  lang: UiLang = "vi",
): string {
  if (state.kind === "saving") return tr(lang, "practice.quiz.save.saving");
  if (state.kind === "error") return tr(lang, "practice.quiz.save.error");
  if (unsavedCount > 0) return tr(lang, "practice.quiz.save.unsaved", { n: unsavedCount });
  if (state.kind === "saved") return tr(lang, "practice.quiz.save.saved", { time: formatClock(state.at) });
  return tr(lang, "practice.quiz.save.idle");
}

/** Khoá localStorage cho các câu đánh dấu xem lại của một lượt làm bài. */
export function flagStorageKey(attemptId: string): string {
  return `quiz-flags:${attemptId}`;
}

/** Đọc danh sách đã lưu; hỏng hoặc không có thì coi như chưa đánh dấu câu nào. */
export function parseFlagged(raw: string | null, validIds: ReadonlySet<string>): Set<string> {
  if (!raw) return new Set();
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string" && validIds.has(x)));
  } catch {
    return new Set();
  }
}

// ── Nháp ra giấy (docs/tieu-chi/quiz-nhap-ra-giay.md) ─────────────────────────

/** Chỉ câu có phương án để nhìn mới cần che: câu điền số hay ghép đôi thì che cũng không ngăn được gì. */
const COVERABLE_TYPES = new Set(["mcq", "true_false"]);

interface PaperQuestion {
  type: string;
  extra?: Record<string, unknown> | null;
}

export function isWorkOnPaper(q: PaperQuestion): boolean {
  return COVERABLE_TYPES.has(q.type) && q.extra?.workOnPaper === true;
}

/**
 * Hiện màn hình chuẩn bị giấy bút trước câu đầu? Không hiện khi có giới hạn thời gian, vì đồng hồ đã chạy từ lúc mở bài;
 * và không hiện khi lượt làm đã có câu trả lời, vì đó là lúc học sinh quay lại làm tiếp.
 */
export function showWorkOnPaperIntro(input: {
  questions: readonly PaperQuestion[];
  hasSavedAnswers: boolean;
  timeLimitSec: number | null;
  prepared: boolean;
}): boolean {
  if (input.prepared || input.hasSavedAnswers || input.timeLimitSec) return false;
  return input.questions.some(isWorkOnPaper);
}

/** Câu đang bị che đáp án? Câu đã mở hoặc đã có trả lời thì không che, để học sinh quay lại vẫn thấy lựa chọn của mình. */
export function isOptionsCovered(q: PaperQuestion, input: { hasResponse: boolean; revealed: boolean }): boolean {
  return isWorkOnPaper(q) && !input.hasResponse && !input.revealed;
}

export const preparedStorageKey = (attemptId: string): string => `quiz:${attemptId}:prepared`;
