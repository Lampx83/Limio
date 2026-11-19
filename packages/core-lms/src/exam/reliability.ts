/**
 * Độ tin cậy của một đề thi — điểm TB, độ lệch chuẩn và Cronbach α.
 *
 * Hàm thuần (không đụng DB) để test được bằng ma trận có đáp án biết trước.
 * Route /api/exams/[id]/analytics gom dữ liệu rồi gọi hàm này.
 */

/** Cần ít nhất ngần này bài đã chấm xong thì các con số mới có nghĩa. */
export const RELIABILITY_MIN_ATTEMPTS = 5;

export interface ReliabilityStats {
  /** Số bài đưa vào tính. */
  n: number;
  /** Điểm trung bình, thang 0–100 (%). */
  mean: number;
  /** Độ lệch chuẩn của điểm tổng, thang 0–100 (%). */
  sd: number;
  /** Cronbach α; -1 khi không tính được (mọi bài cùng điểm) hoặc α âm. */
  alpha: number;
}

function variance(xs: number[]): number {
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
}

/**
 * @param matrix hàng = bài làm, cột = câu hỏi, ô = tỉ lệ điểm đạt được (0..1).
 *
 * Cronbach α = k/(k−1) · (1 − Σσ²ᵢ / σ²_tổng), trong đó σ²_tổng là phương sai
 * của TỔNG điểm các câu và σ²ᵢ là phương sai từng câu — cùng một thang.
 * (Bản trước dùng phương sai của TRUNG BÌNH điểm các câu: nhỏ hơn k² lần nên
 * tỉ số bị phóng lên k² lần và α luôn âm, giao diện hiện "—" với mọi đề.)
 */
export function reliabilityFromMatrix(matrix: number[][]): ReliabilityStats | null {
  const n = matrix.length;
  if (n < RELIABILITY_MIN_ATTEMPTS) return null;
  const k = matrix[0]?.length ?? 0;
  if (k < 2) return null;

  const sums = matrix.map((row) => row.reduce((s, x) => s + x, 0));
  const totalsPct = sums.map((s) => (s / k) * 100);
  const mean = totalsPct.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(variance(totalsPct));

  const totalVar = variance(sums);
  let alpha = -1;
  if (totalVar > 0) {
    let itemVarSum = 0;
    for (let q = 0; q < k; q++) itemVarSum += variance(matrix.map((row) => row[q] ?? 0));
    alpha = Math.max(-1, Math.min(1, (k / (k - 1)) * (1 - itemVarSum / totalVar)));
  }

  return {
    n,
    mean: Math.round(mean * 10) / 10,
    sd: Math.round(sd * 10) / 10,
    alpha: Math.round(alpha * 100) / 100,
  };
}
