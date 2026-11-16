/**
 * CENTER K2 — "Chia bài theo số buổi": chia danh sách bài (đúng thứ tự trong khoá) liền mạch cho n buổi, các buổi chênh
 * nhau nhiều nhất một bài; buổi đầu nhận phần dư. Số buổi lớn hơn số bài thì các buổi cuối trống.
 * Hàm thuần, chạy ở trình duyệt; kết quả chỉ nằm trên màn hình cho tới khi giáo viên bấm "Lưu phân phối".
 */
export function distributeLessons<T>(lessons: readonly T[], sessionCount: number): T[][] {
  const n = Math.floor(sessionCount);
  if (!Number.isFinite(n) || n < 1) return [];
  const base = Math.floor(lessons.length / n);
  const extra = lessons.length % n;
  const out: T[][] = [];
  let at = 0;
  for (let i = 0; i < n; i++) {
    const size = base + (i < extra ? 1 : 0);
    out.push(lessons.slice(at, at + size));
    at += size;
  }
  return out;
}
