export type QuizScoringPolicy = "highest" | "latest" | "average";

/**
 * Gộp điểm các lượt đã nộp thành MỘT điểm theo cách GV chọn.
 *
 * `attempts` là các lượt đã nộp, thứ tự bất kỳ; lượt chưa có điểm bị bỏ qua.
 * "Cuối cùng" = lượt nộp muộn nhất (submittedAt), không phải lượt bắt đầu muộn
 * nhất — hai lượt chồng nhau thì lượt nộp sau mới là kết quả học viên chốt.
 */
export function resolveQuizScore(
  attempts: Array<{ scorePct: number | null; submittedAt: Date | null }>,
  policy: QuizScoringPolicy,
): number | null {
  const scored = attempts.filter(
    (a): a is { scorePct: number; submittedAt: Date | null } => a.scorePct !== null,
  );
  if (scored.length === 0) return null;
  if (policy === "latest") {
    const latest = scored.reduce((a, b) =>
      (b.submittedAt?.getTime() ?? 0) >= (a.submittedAt?.getTime() ?? 0) ? b : a,
    );
    return latest.scorePct;
  }
  if (policy === "average") {
    return scored.reduce((s, a) => s + a.scorePct, 0) / scored.length;
  }
  return Math.max(...scored.map((a) => a.scorePct));
}
