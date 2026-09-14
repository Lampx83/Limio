/**
 * Khi nào học sinh được xem đáp án + điểm chi tiết của bài đã nộp.
 *
 * Trước đây chỉ có một cờ boolean `Exam.showResultsAfterSubmit` trên GÓI ĐỀ,
 * và bốn chỗ tự đọc nó theo kiểu riêng. Cờ nằm ở gói đề là sai tầng: cùng một
 * gói đề mở được nhiều ca thi, nên tắt cờ cho ca hôm nay là tắt luôn cho ca
 * tuần trước — mà học sinh ca đó đã nộp và đã xem được đáp án rồi. Cờ được
 * đọc SỐNG mỗi lần xem lại, không chụp lại lúc nộp, nên đổi cờ là đổi ngược
 * cả quá khứ.
 *
 * Nay chính sách nằm trên CA THI (`ExamSession.revealAnswers`), NULL = kế
 * thừa gói đề. Cùng khuôn với `durationOverrideMin` đã có sẵn ở đó.
 *
 * File này là chỗ DUY NHẤT quyết định. Bốn chỗ đọc cờ cũ đều gọi vào đây.
 */

import { sessionOpenState, type SessionWindowInput } from "./session-window";

export type RevealPolicy = "immediately" | "never" | "after_close" | "score_only";

/** Phần của ca thi mà quyết định này cần. Trùng khuôn `SessionWindowInput`. */
export interface RevealSessionInput extends SessionWindowInput {
  revealAnswers: RevealPolicy | null;
}

/**
 * Chính sách có hiệu lực: ca thi thắng, không có thì theo gói đề.
 *
 * `session = null` xảy ra với bài làm cũ có trước cột `ExamAttempt.sessionId`
 * — rơi về đúng hành vi trước đây, không đổi gì dưới chân người đang dùng.
 */
export function resolveRevealPolicy(
  session: Pick<RevealSessionInput, "revealAnswers"> | null,
  exam: { showResultsAfterSubmit: boolean },
): RevealPolicy {
  if (session?.revealAnswers) return session.revealAnswers;
  return exam.showResultsAfterSubmit ? "immediately" : "never";
}

/**
 * Ngay lúc `now` này, bài đã nộp có được xem ĐÁP ÁN (chi tiết từng câu) chưa.
 *
 * `score_only` trả false ở đây — nó cho xem điểm (`canRevealScoreNow` dưới)
 * chứ không cho xem câu nào đúng/sai hay đáp án.
 *
 * `after_close` hỏi lại `sessionOpenState` thay vì tự so ngày — cùng một hàm
 * mà cổng vào thi đang dùng. Hai bên lệch nhau thì sinh ra đúng loại lỗi
 * "chỗ này bảo đóng, chỗ kia bảo chưa" mà session-window.ts sinh ra để dẹp.
 *
 * Không có ca thi mà chính sách là `after_close` thì trả false: không biết
 * lúc nào đóng thì không lộ, chọn hướng an toàn.
 */
export function canRevealNow(
  policy: RevealPolicy,
  session: SessionWindowInput | null,
  now: Date,
): boolean {
  if (policy === "immediately") return true;
  if (policy === "never" || policy === "score_only") return false;
  return session !== null && sessionOpenState(session, now) === "closed";
}

/**
 * Ngay lúc `now` này, bài đã nộp có được xem ĐIỂM CUỐI CÙNG chưa (không nhất
 * thiết kèm đáp án — xem `canRevealNow` cho phần đó).
 *
 * `score_only` lộ điểm ngay, giống `immediately`; `never` vẫn giấu tuyệt đối.
 */
export function canRevealScoreNow(
  policy: RevealPolicy,
  session: SessionWindowInput | null,
  now: Date,
): boolean {
  if (policy === "immediately" || policy === "score_only") return true;
  if (policy === "never") return false;
  return session !== null && sessionOpenState(session, now) === "closed";
}

/** Gộp hai bước trên — dạng dùng thường gặp nhất ở các chỗ đọc. */
export function canRevealAnswers(
  session: RevealSessionInput | null,
  exam: { showResultsAfterSubmit: boolean },
  now: Date,
): boolean {
  return canRevealNow(resolveRevealPolicy(session, exam), session, now);
}

/** Biến thể của `canRevealAnswers` cho riêng điểm số — xem `canRevealScoreNow`. */
export function canRevealScore(
  session: RevealSessionInput | null,
  exam: { showResultsAfterSubmit: boolean },
  now: Date,
): boolean {
  return canRevealScoreNow(resolveRevealPolicy(session, exam), session, now);
}

/** Nhãn tiếng Việt dùng chung cho mọi form tổ chức thi. */
export const REVEAL_POLICY_LABELS: Record<RevealPolicy, string> = {
  immediately: "Hiện ngay sau khi nộp",
  never: "Không hiện",
  after_close: "Hiện sau khi đóng ca",
  score_only: "Hiện điểm, không hiện đáp án",
};

/**
 * Mảnh `select` của Prisma cho quan hệ `session`, dùng lại ở mọi chỗ đọc.
 *
 * Để tập trung một chỗ vì quên một field ở đây thì `after_close` âm thầm tính
 * sai chứ không nổ — loại lỗi không ai thấy cho tới khi học sinh thấy đáp án
 * sớm hơn dự kiến.
 */
export const REVEAL_SESSION_SELECT = {
  revealAnswers: true,
  opensAt: true,
  closesAt: true,
  timingMode: true,
  status: true,
} as const;
