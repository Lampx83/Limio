/**
 * Cầu nối giữa QuizPlayer và liên kết "Quay lại khóa học" nằm ngoài nó (trang
 * server render liên kết, còn số câu đã chọn nằm trong state của QuizPlayer).
 *
 * QuizPlayer đăng ký một hàm trả về lời nhắc (hoặc null); liên kết gọi hàm đó
 * trước khi điều hướng. Chỉ có một màn làm quiz trên một trang nên một biến
 * module là đủ.
 */
let guard: (() => string | null) | null = null;

export function setQuizLeaveGuard(fn: (() => string | null) | null): void {
  guard = fn;
}

export function checkQuizLeave(): string | null {
  return guard ? guard() : null;
}
