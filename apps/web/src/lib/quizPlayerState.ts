/**
 * Logic thuần của màn làm quiz (QuizPlayer): trạng thái từng câu, lời nhắc
 * trước khi nộp, dòng báo "đã lưu".
 *
 * Tách ra khỏi component để kiểm thử được mà không cần dựng giao diện. Mọi
 * chuỗi ở đây là chuỗi người học đọc, nên viết thành câu đủ ý.
 */

/** done = đã trả lời và (nếu bắt buộc) đã chọn độ tự tin; câu này được lưu và tính điểm. */
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

/** [3] → "3"; [3, 5] → "3 và 5"; [3, 5, 7] → "3, 5 và 7". */
export function joinNumbers(nums: number[]): string {
  if (nums.length === 0) return "";
  if (nums.length === 1) return String(nums[0]);
  return `${nums.slice(0, -1).join(", ")} và ${nums[nums.length - 1]}`;
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
}): string | null {
  const { empty, needsConfidence, flagged } = input;
  if (empty.length === 0 && needsConfidence.length === 0 && flagged.length === 0) return null;

  const lines: string[] = [];
  if (empty.length > 0) {
    lines.push(`• Câu ${joinNumbers(empty)} bạn chưa trả lời.`);
  }
  if (needsConfidence.length > 0) {
    lines.push(
      `• Câu ${joinNumbers(needsConfidence)} bạn đã chọn đáp án nhưng chưa chọn độ tự tin, nên chưa được lưu và sẽ tính là bỏ trống.`,
    );
  }
  if (flagged.length > 0) {
    lines.push(`• Câu ${joinNumbers(flagged)} bạn đã đánh dấu để xem lại.`);
  }
  return `Trước khi nộp, bạn kiểm tra lại:\n${lines.join("\n")}\n\nNộp bài xong thì không sửa lại được. Bạn vẫn muốn nộp?`;
}

/**
 * Lời nhắc khi rời trang mà còn câu chưa được lưu lên máy chủ (thiếu số sao, mất mạng,
 * hoặc vừa chọn xong chưa kịp lưu). Null nếu mọi câu đã chọn đều đã lưu: lượt làm bài
 * vẫn còn, người học vào lại là làm tiếp.
 */
export function leaveWarning(unsavedNumbers: number[]): string | null {
  if (unsavedNumbers.length === 0) return null;
  return `Câu ${joinNumbers(unsavedNumbers)} chưa được lưu. Nếu rời đi bây giờ, ${
    unsavedNumbers.length === 1 ? "câu đó" : "những câu đó"
  } sẽ không còn khi bạn quay lại. Bạn vẫn muốn rời đi?`;
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
): string {
  if (state.kind === "saving") return "Đang lưu…";
  if (state.kind === "error") return "Chưa lưu được. Bạn kiểm tra kết nối mạng rồi chọn lại đáp án.";
  if (unsavedCount > 0) return `Còn ${unsavedCount} câu chưa được lưu.`;
  if (state.kind === "saved") return `Đã lưu lúc ${formatClock(state.at)}.`;
  return "Bài làm được lưu ngay khi bạn chọn xong mỗi câu.";
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
