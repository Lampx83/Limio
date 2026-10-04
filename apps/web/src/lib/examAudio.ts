/**
 * LANG G5b — luật hiển thị lượt nghe của đề thi thử. Phản chiếu `audioPlayLimit` ở
 * core-lms (máy khách không import được core vì kéo theo prisma); máy chủ mới là bên
 * quyết định, đây chỉ để giao diện hiện "Còn N lượt" và khoá nút cho khớp.
 */
export type ExamAudioPolicy = "free_replay" | "limited_replay" | "once_only";

export function audioLimit(policy: ExamAudioPolicy, max: number | null | undefined): number | null {
  if (policy === "free_replay") return null;
  if (policy === "once_only") return 1;
  return max && max >= 1 ? max : 1;
}

export interface AudioPlayView {
  /** true = không giới hạn (dùng trình phát gốc). */
  unlimited: boolean;
  remaining: number | null;
  canPlay: boolean;
  /** Dòng hiện cho thí sinh. */
  label: string;
}

export function audioPlayView(policy: ExamAudioPolicy, max: number | null | undefined, used: number): AudioPlayView {
  const limit = audioLimit(policy, max);
  if (limit === null) return { unlimited: true, remaining: null, canPlay: true, label: "" };
  const remaining = Math.max(0, limit - used);
  const label =
    remaining === 0
      ? "Đã hết lượt nghe"
      : policy === "once_only"
        ? "Chỉ nghe 1 lần — không tua, không dừng, không nghe lại"
        : `Còn ${remaining} lượt nghe (mỗi lượt nghe từ đầu, không tua)`;
  return { unlimited: false, remaining, canPlay: remaining > 0, label };
}
