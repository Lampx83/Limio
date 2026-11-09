import { VAN_DAP_LIMITS } from "./types";

/**
 * Bản đồ câu hỏi (AC1.7): thầy/cô xem trước "AI sẽ hỏi gì, theo thứ tự nào, trong bao nhiêu câu".
 * Hàm thuần, không đụng DB. Ước lượng thô nhưng ĐỀU ĐẶN và giải thích được:
 *  - một lượt hỏi–đáp ≈ MINUTES_PER_EXCHANGE phút, nên thời lượng quyết định tổng số câu;
 *  - lượt 1: mỗi ý một câu hỏi chính theo thứ tự ưu tiên, đến khi hết quỹ câu;
 *  - lượt 2: quỹ còn lại chia cho các câu đào sâu, ưu tiên ý đứng trước, mỗi ý tối đa `maxFollowUps`.
 */
export const MINUTES_PER_EXCHANGE = 1.5;

export interface QuestionMapItemInput {
  id: string;
  core: string;
  level: string;
  maxFollowUps: number;
}

export interface QuestionMapInput {
  items: QuestionMapItemInput[];
  scenarios: Array<{ id: string; title: string }>;
  durationMin: number;
}

export interface QuestionMapRow {
  id: string;
  position: number;
  core: string;
  level: string;
  /** Ý này có được hỏi kịp trong thời lượng không. */
  covered: boolean;
  /** Số câu ước tính cho ý (1 câu chính + đào sâu). 0 nếu không kịp. */
  estimatedQuestions: number;
}

export interface QuestionMap {
  capacity: number;
  rows: QuestionMapRow[];
  coveredCount: number;
  uncoveredCount: number;
  totalEstimatedQuestions: number;
  scenarios: Array<{ id: string; title: string }>;
}

export function buildQuestionMap(input: QuestionMapInput): QuestionMap {
  const capacity = Math.max(0, Math.floor(input.durationMin / MINUTES_PER_EXCHANGE));
  let remaining = capacity;
  const rows: QuestionMapRow[] = input.items.map((it, i) => {
    const covered = remaining > 0;
    if (covered) remaining -= 1;
    return { id: it.id, position: i + 1, core: it.core, level: it.level, covered, estimatedQuestions: covered ? 1 : 0 };
  });
  for (let i = 0; i < rows.length && remaining > 0; i++) {
    const row = rows[i]!;
    if (!row.covered) break;
    const extra = Math.min(
      Math.max(0, Math.min(input.items[i]!.maxFollowUps, VAN_DAP_LIMITS.maxFollowUpsLimit)),
      remaining,
    );
    row.estimatedQuestions += extra;
    remaining -= extra;
  }
  const coveredCount = rows.filter((r) => r.covered).length;
  return {
    capacity,
    rows,
    coveredCount,
    uncoveredCount: rows.length - coveredCount,
    totalEstimatedQuestions: rows.reduce((n, r) => n + r.estimatedQuestions, 0),
    scenarios: input.scenarios,
  };
}
