import type { ExamResultRow } from "@feedbackme/core-lms";

/**
 * Nhãn trạng thái của một dòng kết quả — dùng chung cho trang kết quả và file
 * Excel để hai nơi không bao giờ nói hai chuyện khác nhau.
 *
 * "Đã chấm" nghĩa là bài không còn câu nào chờ chấm tay và đã có điểm. Bài
 * tự chấm hoàn toàn (trắc nghiệm) không đổi status sang "graded", nên không
 * dựa vào status để báo "đã chấm".
 */
export type ResultTone = "muted" | "info" | "warn" | "ok";

export interface ResultVerdict {
  label: string;
  tone: ResultTone;
}

export function resultVerdict(
  r: Pick<ExamResultRow, "status" | "score" | "needsGrading">,
): ResultVerdict {
  if (r.status === "not_started") return { label: "Chưa làm", tone: "muted" };
  if (r.status === "in_progress") return { label: "Đang làm", tone: "info" };
  if (r.needsGrading) return { label: "Còn câu chờ chấm", tone: "warn" };
  if (r.score != null) return { label: "Đã chấm", tone: "ok" };
  return { label: "Đã nộp", tone: "muted" };
}

export const TONE_CLASS: Record<ResultTone, string> = {
  muted: "text-faint",
  info: "text-blue-700",
  warn: "text-amber-700",
  ok: "text-emerald-700",
};

/** 50.0% — một chữ số thập phân, giống con số trung bình trên đầu trang. */
export function formatPct(pct: number): string {
  return `${pct.toFixed(1)}%`;
}
