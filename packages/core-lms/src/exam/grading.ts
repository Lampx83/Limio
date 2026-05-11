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
    case "essay":
    case "short_answer":
      // SHORT auto-grade with fuzzy + accept-list lands in P1. Treat as manual
      // for P0 so instructor can review.
      return { autoScore: null, needsGrading: true };
    default:
      return { autoScore: null, needsGrading: true };
  }
}
