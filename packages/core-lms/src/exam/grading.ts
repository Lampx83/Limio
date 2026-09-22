import type { ExamQuestionType } from "@feedbackme/db";

/**
 * Pure per-type grader. Given a question's config + the learner's answer
 * payload, return either:
 *   { autoScore: number, needsGrading: false }  → fully auto-gradeable
 *   { autoScore: null,   needsGrading: true  }  → ESSAY / SHORT (manual queue)
 *
 * No partial credit in P0. MULTI returns full points only when answer set
 * equals correct set exactly.
 */
export interface GradeResult {
  autoScore: number | null;
  needsGrading: boolean;
}

function gradeMcq(config: unknown, answer: unknown, points: number): GradeResult {
  const opts = (config as { options: Array<{ id: string; isCorrect: boolean }> }).options;
  const correctIds = new Set(opts.filter((o) => o.isCorrect).map((o) => o.id));
  const chosen = ((answer as { optionIds?: string[] } | null)?.optionIds ?? [])
    .filter((id) => typeof id === "string");
  if (chosen.length !== 1) return { autoScore: 0, needsGrading: false };
  return {
    autoScore: correctIds.has(chosen[0]!) ? points : 0,
    needsGrading: false,
  };
}

function gradeMulti(config: unknown, answer: unknown, points: number): GradeResult {
  const opts = (config as { options: Array<{ id: string; isCorrect: boolean }> }).options;
  const correctIds = new Set(opts.filter((o) => o.isCorrect).map((o) => o.id));
  const chosen = new Set(
    ((answer as { optionIds?: string[] } | null)?.optionIds ?? []).filter(
      (id) => typeof id === "string",
    ),
  );
  if (chosen.size !== correctIds.size) return { autoScore: 0, needsGrading: false };
  for (const id of correctIds) if (!chosen.has(id)) return { autoScore: 0, needsGrading: false };
  return { autoScore: points, needsGrading: false };
}

function gradeTrueFalseNotGiven(
  config: unknown,
  answer: unknown,
  points: number,
): GradeResult {
  const correct = (config as { correct: string }).correct;
  const chosen = (answer as { correct?: string } | null)?.correct;
  return {
    autoScore: chosen === correct ? points : 0,
    needsGrading: false,
  };
}

function matches(
  candidate: string,
  accepted: string[],
  mode: "exact" | "case_insensitive",
): boolean {
  if (mode === "exact") return accepted.includes(candidate);
  const lower = candidate.toLowerCase().trim();
  return accepted.some((a) => a.toLowerCase().trim() === lower);
}

function gradeGapFill(config: unknown, answer: unknown, points: number): GradeResult {
  const blanks = (config as {
    blanks: Array<{
      id: string;
      acceptedAnswers: string[];
      matchMode: "exact" | "case_insensitive";
    }>;
  }).blanks;
  const submitted = (answer as { blanks?: Record<string, string> } | null)?.blanks ?? {};
  // No partial credit: every blank must be correct for full points (P0 rule).
  for (const b of blanks) {
    const v = submitted[b.id];
    if (typeof v !== "string" || !matches(v, b.acceptedAnswers, b.matchMode)) {
      return { autoScore: 0, needsGrading: false };
    }
  }
  return { autoScore: points, needsGrading: false };
}

// ---------------------------------------------------------------------------
// Đợt 1 (thống nhất nhập câu hỏi Quiz/Bank/Exam) — 4 loại mới, cấu trúc
// answerJson theo đúng shape config tương ứng ở schemas.ts. Không có điểm
// từng phần cho loại nào (giữ đúng quy tắc P0 "no partial credit").
// ---------------------------------------------------------------------------

/** Ordering — answer.order là mảng id theo thứ tự thí sinh chọn. */
function gradeOrdering(config: unknown, answer: unknown, points: number): GradeResult {
  const items = (config as { items: Array<{ id: string }> }).items;
  const canonical = items.map((i) => i.id);
  const userOrder = (
    (answer as { order?: unknown } | null)?.order ?? []
  ) as unknown[];
  const ids = Array.isArray(userOrder)
    ? userOrder.filter((x): x is string => typeof x === "string")
    : [];
  if (ids.length !== canonical.length) return { autoScore: 0, needsGrading: false };
  const isCorrect = ids.every((id, i) => id === canonical[i]);
  return { autoScore: isCorrect ? points : 0, needsGrading: false };
}

/**
 * Matching — mỗi cặp trong config đã gom sẵn cả 2 vế (left/right, cùng id).
 * answer.matched: pairId (vế trái) → id của cặp mà thí sinh chọn cho vế phải.
 * Đúng khi mọi cặp tự ghép với chính nó (matched[p.id] === p.id).
 */
function gradeMatching(config: unknown, answer: unknown, points: number): GradeResult {
  const pairs = (config as { pairs: Array<{ id: string }> }).pairs;
  const matched = (answer as { matched?: Record<string, unknown> } | null)?.matched ?? {};
  for (const p of pairs) {
    if (matched[p.id] !== p.id) return { autoScore: 0, needsGrading: false };
  }
  return { autoScore: points, needsGrading: false };
}

/** Numerical — answer.value chấp nhận cả number lẫn chuỗi số (nhập từ input text). */
function gradeNumerical(config: unknown, answer: unknown, points: number): GradeResult {
  const cfg = config as { expected: number; tolerance?: number };
  const raw = (answer as { value?: unknown } | null)?.value;
  const num =
    typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(num)) return { autoScore: 0, needsGrading: false };
  const tolerance = typeof cfg.tolerance === "number" ? cfg.tolerance : 0;
  const isCorrect = Math.abs(num - cfg.expected) <= tolerance;
  return { autoScore: isCorrect ? points : 0, needsGrading: false };
}

/**
 * Drag-drop-fill — answer.placed: blankIndex (dạng chuỗi số) → id token đặt
 * vào đó. All-or-nothing trên MỌI chỗ trống thật (blankIndex khác null) —
 * mồi nhử (blankIndex null) không tham gia chấm.
 */
function gradeDragDropFill(config: unknown, answer: unknown, points: number): GradeResult {
  const tokens = (config as { tokens: Array<{ id: string; blankIndex: number | null }> })
    .tokens;
  const placed = (answer as { placed?: Record<string, unknown> } | null)?.placed ?? {};
  const expected = new Map<number, string>();
  for (const t of tokens) {
    if (typeof t.blankIndex === "number") expected.set(t.blankIndex, t.id);
  }
  if (expected.size === 0) return { autoScore: 0, needsGrading: false };
  for (const [idx, tokenId] of expected) {
    if (placed[String(idx)] !== tokenId) return { autoScore: 0, needsGrading: false };
  }
  return { autoScore: points, needsGrading: false };
}

/** Grade one answer. Returns null autoScore + needsGrading=true for essay/short. */
export function gradeExamAnswer(
  type: ExamQuestionType,
  config: unknown,
  answerJson: unknown,
  points: number,
): GradeResult {
  switch (type) {
    case "mcq":
      return gradeMcq(config, answerJson, points);
    case "multi":
      return gradeMulti(config, answerJson, points);
    case "true_false_notgiven":
      return gradeTrueFalseNotGiven(config, answerJson, points);
    case "gap_fill":
      return gradeGapFill(config, answerJson, points);
    case "ordering":
      return gradeOrdering(config, answerJson, points);
    case "matching":
      return gradeMatching(config, answerJson, points);
    case "numerical":
      return gradeNumerical(config, answerJson, points);
    case "drag_drop_fill":
      return gradeDragDropFill(config, answerJson, points);
    case "essay":
    case "short_answer":
      // SHORT auto-grade with fuzzy + accept-list lands in P1. Treat as manual
      // for P0 so instructor can review.
      return { autoScore: null, needsGrading: true };
    default:
      return { autoScore: null, needsGrading: true };
  }
}
