type NavRow = {
  submission: { id: string; status: "submitted" | "graded" } | null;
};

export type SubmissionNeighbors = {
  prevId: string | null;
  nextId: string | null;
  /** Vị trí 1-based của bài đang mở trong danh sách điều hướng; 0 nếu không có. */
  position: number;
  total: number;
};

/**
 * Bài trước/sau của bài đang mở, theo đúng thứ tự bảng GV đang thấy (đã lọc,
 * đã sắp xếp). Dòng chưa nộp bị bỏ qua. `pendingOnly` bỏ thêm các bài đã chấm,
 * trừ bài đang mở — để chấm xong bài này nó không biến khỏi danh sách giữa chừng.
 */
export function neighborSubmissions(
  orderedRows: NavRow[],
  currentId: string,
  pendingOnly: boolean,
): SubmissionNeighbors {
  const list = orderedRows.flatMap((r) =>
    r.submission &&
    (!pendingOnly || r.submission.status === "submitted" || r.submission.id === currentId)
      ? [r.submission.id]
      : [],
  );
  const i = list.indexOf(currentId);
  if (i === -1) return { prevId: null, nextId: null, position: 0, total: list.length };
  return {
    prevId: (i > 0 ? list[i - 1] : null) ?? null,
    nextId: (i < list.length - 1 ? list[i + 1] : null) ?? null,
    position: i + 1,
    total: list.length,
  };
}
