/**
 * B9.1 — SSMMD coding of feedback.
 *
 * The Feedback Engine produces feedback but, until now, said nothing about what
 * kind of feedback it produced. Without that, the corpus cannot be described
 * (what share is process-level? how elaborated is it?) and cannot be compared
 * across conditions later.
 *
 * This module assigns each delivery its analytic coordinates on three layers:
 *
 *   macro — `sourceKind`: which data and model produced the text
 *   meso  — `level` / `levels`: what the feedback targets (Hattie & Timperley)
 *   micro — `elaboration`: how much it elaborates (Narciss-style ladder)
 *
 * Coding happens **at generation time**, from the inputs that actually chose the
 * text — never by parsing the text afterwards. It is a pure function so it can
 * be tested without a database and reused by the backfill script.
 */

import type {
  FeedbackElaboration,
  FeedbackLevel,
  FeedbackSourceKind,
  FeedbackTemplateScope,
} from "@feedbackme/db";

/**
 * Bumped whenever the rules below change, and stored on every coded row. Two
 * rows coded by different versions are not directly comparable, and a reader of
 * the data needs to be able to tell.
 */
export const CODER_VERSION = "b9.coding.v1";

/**
 * Meso layers ordered by how far they go beyond the item itself. `self` is not
 * in the ladder: the Feedback Engine never emits person-directed praise (it is
 * the least effective level in Hattie & Timperley, and recognition belongs to
 * the gamification channel). The enum value exists so the schema can represent
 * it if that ever changes.
 */
const LEVEL_ORDER: FeedbackLevel[] = ["task", "process", "self_regulation"];

export interface CodingInput {
  /** Scope of the template that supplied the body; null when none matched. */
  templateScope: FeedbackTemplateScope | null;
  /** Instructor-declared level on that template — wins over inference. */
  declaredLevel?: FeedbackLevel | null;
  /** Instructor-declared elaboration on that template — wins over inference. */
  declaredElaboration?: FeedbackElaboration | null;
  /** Misconception matched against the distractor the learner actually chose. */
  misconceptionCode: string | null;
  /** How many remediation lessons were surfaced alongside the text. */
  remediationCount: number;
}

export interface FeedbackCoding {
  level: FeedbackLevel;
  levels: FeedbackLevel[];
  elaboration: FeedbackElaboration;
  sourceKind: FeedbackSourceKind;
}

/**
 * AC-2.1..2.6 — derive the coordinates of one delivery.
 *
 * Every delivery is task-level: it always tells the learner this item was
 * wrong. It becomes process-level when it can say *why* — which requires a
 * misconception attached to the option they picked, or a skill-scoped
 * explanation. It reaches self-regulation only when it also tells them what to
 * do next, which in this system means surfacing specific lessons to review.
 */
export function codeFeedback(input: CodingInput): FeedbackCoding {
  const hasMisconception = input.misconceptionCode !== null;
  const hasRemediation = input.remediationCount > 0;
  const hasTemplate = input.templateScope !== null;

  // ── meso ────────────────────────────────────────────────────────────────
  const levels: FeedbackLevel[] = ["task"]; // AC-2.3
  if (hasMisconception || input.templateScope === "per_skill") {
    levels.push("process"); // AC-2.1
  }
  if (hasRemediation) {
    levels.push("self_regulation"); // AC-2.2
  }
  // AC-2.4: `self` is never added.

  // AC-2.5 — dominant level is the furthest-reaching one present.
  const inferredLevel = LEVEL_ORDER.reduce<FeedbackLevel>(
    (best, candidate) => (levels.includes(candidate) ? candidate : best),
    "task",
  );

  // ── micro ───────────────────────────────────────────────────────────────
  // AC-2.6 — deepest layer present, not a count of layers.
  let inferredElaboration: FeedbackElaboration;
  if (hasMisconception && hasRemediation) {
    inferredElaboration = "elaborated";
  } else if (hasMisconception) {
    inferredElaboration = "km";
  } else if (hasRemediation) {
    inferredElaboration = "kh";
  } else if (hasTemplate) {
    inferredElaboration = "kcr";
  } else {
    // Only the hard-coded fallback sentence — the learner learns that they were
    // wrong and nothing else.
    inferredElaboration = "kr";
  }

  // ── macro ───────────────────────────────────────────────────────────────
  // Today the learner-facing body is always assembled deterministically. When a
  // model starts generating bodies, that path sets `llm` / `hybrid` instead.
  const sourceKind: FeedbackSourceKind = hasMisconception
    ? "misconception"
    : "rule_template";

  // AC-2.8 — a declared value on the template wins over inference. `levels`
  // still reports what was actually composed, so a mis-declaration is visible
  // in the data rather than hidden by it.
  const level = input.declaredLevel ?? inferredLevel;
  const elaboration = input.declaredElaboration ?? inferredElaboration;

  return { level, levels, elaboration, sourceKind };
}

/** Shape of `FeedbackDelivery.generationContext`. AC-2.7. */
export interface GenerationContext {
  coderVersion: string;
  templateScope: FeedbackTemplateScope | null;
  templateId: string | null;
  misconceptionCode: string | null;
  /** Knowledge components the question carried when feedback was chosen. */
  skillIds: string[];
  remediationLessonIds: string[];
  /** Lessons that matched but were dropped because the learner finished them. */
  remediationExcludedCompleted: number;
  /**
   * BKT estimate per skill captured *before* this attempt was scored — what the
   * system believed about this learner when it chose this feedback. The caller
   * must snapshot it before scoring, because BKT updates run concurrently with
   * generation; when no snapshot is supplied the field is absent rather than
   * filled with a racy value. Also absent on retroactively coded rows.
   */
  masteryAtGeneration?: Record<string, number>;
  /** True only for rows coded by the backfill script rather than at delivery. */
  codedRetroactively?: boolean;
}
