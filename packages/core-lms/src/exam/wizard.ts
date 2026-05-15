/**
 * A5.5 — Wizard "Tạo đề trong 3 bước" assembler (Cơ bản mode).
 *
 * Stateless functions that translate a 3-step WizardConfig into:
 *   - a bucketed PoolFilter (for ExamSection.poolFilter random_from_bank)
 *   - a pool availability preview (per-bucket counts + deficits)
 *
 * No DB writes here — write paths live in exam create/update flow.
 *
 * Difficulty profiles (5-band weight vectors, %):
 *   basic     — easy-leaning              [30, 40, 30,  0,  0]
 *   balanced  — overall assessment        [10, 25, 40, 20,  5]
 *   challenge — stretch goals             [ 0, 10, 30, 40, 20]
 *   adaptive_to_class — derive from cohort θ̄; fallback "balanced" when
 *                       there is no LearnerSkillState data yet.
 *
 * Bloom mix is 3-bucket (remember_understand / apply / analyze_plus).
 * The cross-product (Bloom × Difficulty) defines the wizard's buckets.
 */

import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";

// ============================================================================
// Wizard config (mirrors ExamWizardConfig DB model — see schema.prisma)
// ============================================================================

export const BloomMix = z
  .object({
    remember_understand: z.number().min(0).max(100),
    apply: z.number().min(0).max(100),
    analyze_plus: z.number().min(0).max(100),
  })
  .refine(
    (m) => Math.abs(m.remember_understand + m.apply + m.analyze_plus - 100) < 0.5,
    { message: "bloom mix must sum to 100" },
  );
export type BloomMixT = z.infer<typeof BloomMix>;

export const DifficultyProfile = z.enum([
  "basic",
  "balanced",
  "challenge",
  "adaptive_to_class",
]);
export type DifficultyProfileT = z.infer<typeof DifficultyProfile>;

export const DistributionMode = z.enum([
  "single",
  "shuffled_per_student",
  "multi_session",
]);
export type DistributionModeT = z.infer<typeof DistributionMode>;

/** Inner object shape — export separately so callers can .omit() without ZodEffects. */
export const WizardConfigShape = z.object({
  courseId: z.string().uuid(),
  lessonIds: z.array(z.string().uuid()).min(1, "Chọn ít nhất 1 bài học"),
  questionCount: z.number().int().min(5).max(200),
  bloomMix: BloomMix,
  difficultyProfile: DifficultyProfile,
  distributionMode: DistributionMode,
  sessionCount: z.number().int().min(2).max(8).optional(),
  autoEquating: z.boolean().default(true),
});

export const WizardConfig = WizardConfigShape.refine(
  (c) => c.distributionMode !== "multi_session" || c.sessionCount !== undefined,
  { message: "multi_session requires sessionCount" },
);
export type WizardConfigT = z.infer<typeof WizardConfigShape>;

// ============================================================================
// Difficulty profile → 5-band weight vector
// ============================================================================

const PROFILE_WEIGHTS: Record<Exclude<DifficultyProfileT, "adaptive_to_class">, [number, number, number, number, number]> = {
  basic:     [30, 40, 30,  0,  0],
  balanced:  [10, 25, 40, 20,  5],
  challenge: [ 0, 10, 30, 40, 20],
};

/**
 * Resolve a difficulty profile to its 5-band weight vector (indexes 0..4 ↔
 * difficulty 1..5). For "adaptive_to_class", check whether the course has any
 * `LearnerSkillState` data — if not, fall back to "balanced" (returned with a
 * `fallbackUsed` flag so the UI can show a toast).
 */
export async function resolveDifficultyWeights(
  profile: DifficultyProfileT,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<{ weights: [number, number, number, number, number]; fallbackUsed: boolean }> {
  if (profile !== "adaptive_to_class") {
    return { weights: PROFILE_WEIGHTS[profile], fallbackUsed: false };
  }
  // Adaptive mode: check if cohort has any learner skill state.
  const enrolledIds = await db.enrollment.findMany({
    where: { courseId },
    select: { userId: true },
  });
  if (enrolledIds.length === 0) {
    return { weights: PROFILE_WEIGHTS.balanced, fallbackUsed: true };
  }
  const stateCount = await db.learnerSkillState.count({
    where: { userId: { in: enrolledIds.map((e) => e.userId) } },
  });
  if (stateCount === 0) {
    return { weights: PROFILE_WEIGHTS.balanced, fallbackUsed: true };
  }
  // TODO (Phase 2): compute cohort θ̄ and shift weights toward the band that
  // peaks Test Information at that ability. For now keep balanced + flag false
  // so caller knows adaptive was usable (not a fallback) even though we
  // haven't materialised the shift yet.
  return { weights: PROFILE_WEIGHTS.balanced, fallbackUsed: false };
}

// ============================================================================
// Bucket distribution (cross-product of Bloom × Difficulty quotas)
// ============================================================================

type Bloom = keyof BloomMixT;
const BLOOM_KEYS: readonly Bloom[] = ["remember_understand", "apply", "analyze_plus"] as const;

export interface ResolvedBucket {
  cognitiveLevel: Bloom;
  difficulty: number; // 1..5
  count: number;
}

/**
 * Cross-product: total = `questionCount`. Bloom rows × Difficulty columns.
 * Each cell gets `round(total × bloom% × diff% / 10000)`. Rounding drift is
 * absorbed by adding/removing 1 from the largest cell(s) until the total
 * matches exactly.
 *
 * Zero-count cells are dropped (cleaner downstream — sampler won't query empty
 * filters).
 */
export function distributeBuckets(
  questionCount: number,
  bloomMix: BloomMixT,
  difficultyWeights: [number, number, number, number, number],
): ResolvedBucket[] {
  const raw: Array<ResolvedBucket & { exact: number }> = [];
  for (const bloom of BLOOM_KEYS) {
    const bloomPct = bloomMix[bloom];
    if (bloomPct === 0) continue;
    for (let d = 1; d <= 5; d++) {
      const diffPct = difficultyWeights[d - 1]!;
      if (diffPct === 0) continue;
      const exact = (questionCount * bloomPct * diffPct) / 10000;
      raw.push({
        cognitiveLevel: bloom,
        difficulty: d,
        count: Math.floor(exact),
        exact,
      });
    }
  }
  // Repair rounding drift.
  let sum = raw.reduce((a, b) => a + b.count, 0);
  if (sum < questionCount) {
    // Add 1 to cells with largest fractional residual.
    const sortedByResidual = [...raw].sort(
      (a, b) => (b.exact - b.count) - (a.exact - a.count),
    );
    for (let i = 0; sum < questionCount && i < sortedByResidual.length; i++) {
      sortedByResidual[i]!.count += 1;
      sum += 1;
    }
  } else if (sum > questionCount) {
    // Should be rare with Math.floor, but guard anyway.
    const sortedByResidualAsc = [...raw].sort(
      (a, b) => (a.exact - a.count) - (b.exact - b.count),
    );
    for (let i = 0; sum > questionCount && i < sortedByResidualAsc.length; i++) {
      if (sortedByResidualAsc[i]!.count > 0) {
        sortedByResidualAsc[i]!.count -= 1;
        sum -= 1;
      }
    }
  }
  return raw
    .filter((b) => b.count > 0)
    .map(({ cognitiveLevel, difficulty, count }) => ({ cognitiveLevel, difficulty, count }));
}

// ============================================================================
// Skill scope + bank scope resolution
// ============================================================================

/**
 * Map lessonIds → skillIds via ContentSkillMapping (contentType = "lesson").
 */
export async function resolveSkillScope(
  lessonIds: string[],
  db: PrismaClient = prisma,
): Promise<string[]> {
  if (lessonIds.length === 0) return [];
  const rows = await db.contentSkillMapping.findMany({
    where: { contentType: "lesson", contentId: { in: lessonIds } },
    select: { skillId: true },
  });
  return [...new Set(rows.map((r) => r.skillId))];
}

/**
 * Banks visible to this course's wizard:
 *   - all `course`-visibility banks where `courseId = course.id`
 *   - the instructor's own `private` banks
 * Org-visibility is reserved (multi-tenant phase).
 */
export async function resolveBankScope(
  courseId: string,
  actorUserId: string,
  db: PrismaClient = prisma,
): Promise<string[]> {
  const banks = await db.questionBank.findMany({
    where: {
      OR: [
        { visibility: "course", courseId },
        { visibility: "private", ownerUserId: actorUserId },
      ],
    },
    select: { id: true },
  });
  return banks.map((b) => b.id);
}

// ============================================================================
// Assemble → bucketed PoolFilter
// ============================================================================

export interface AssembleResult {
  poolFilter: {
    bankIds: string[];
    count: number;
    skillIds: string[] | undefined;
    buckets: ResolvedBucket[];
    type: string[];
  };
  fallbackUsed: boolean; // adaptive_to_class fell back to balanced
}

/**
 * Build the PoolFilter payload from a WizardConfig. Result is intended to be
 * stored on a single ExamSection (selectionMode=random_from_bank,
 * resolutionMode=per_attempt or per_publish — caller decides).
 *
 * Type filter excludes "essay" at Cơ bản (auto-grading-friendly only). The
 * Nâng cao mode editor can include essay manually.
 */
export async function assembleWizardPool(
  config: WizardConfigT,
  actorUserId: string,
  db: PrismaClient = prisma,
): Promise<AssembleResult> {
  const [skillIds, bankIds, { weights, fallbackUsed }] = await Promise.all([
    resolveSkillScope(config.lessonIds, db),
    resolveBankScope(config.courseId, actorUserId, db),
    resolveDifficultyWeights(config.difficultyProfile, config.courseId, db),
  ]);
  const buckets = distributeBuckets(config.questionCount, config.bloomMix, weights);
  return {
    poolFilter: {
      bankIds,
      count: config.questionCount,
      skillIds: skillIds.length > 0 ? skillIds : undefined,
      buckets,
      type: ["mcq", "multi", "true_false_notgiven", "gap_fill", "short_answer"],
    },
    fallbackUsed,
  };
}

// ============================================================================
// Preview availability — stateless, no writes
// ============================================================================

export interface BucketAvailability extends ResolvedBucket {
  available: number; // how many published bank questions exist for this cell
  deficit: number;   // max(0, count - available)
}

export interface PreviewPoolResult {
  totalRequested: number;
  totalAvailable: number;
  bankIds: string[];
  skillIds: string[];
  buckets: BucketAvailability[];
  deficits: BucketAvailability[]; // subset of buckets with deficit > 0
  fallbackUsed: boolean;
  /** No bank or lesson tagged → caller should show a setup hint. */
  emptyScope: boolean;
}

/**
 * Stateless preview: count published bank questions per bucket and report
 * deficits. Does NOT persist or pick concrete IDs.
 *
 * Implementation note: one COUNT per bucket. With ≤ 3×5 = 15 buckets max
 * and the (bankId, cognitiveLevel, difficulty) composite index, this is
 * cheap enough to run on every wizard slider drag (debounced FE-side).
 */
export async function previewPool(
  config: WizardConfigT,
  actorUserId: string,
  db: PrismaClient = prisma,
): Promise<PreviewPoolResult> {
  const { poolFilter, fallbackUsed } = await assembleWizardPool(config, actorUserId, db);
  const emptyScope = poolFilter.bankIds.length === 0 || (poolFilter.skillIds?.length ?? 0) === 0;

  if (emptyScope) {
    return {
      totalRequested: config.questionCount,
      totalAvailable: 0,
      bankIds: poolFilter.bankIds,
      skillIds: poolFilter.skillIds ?? [],
      buckets: poolFilter.buckets.map((b) => ({ ...b, available: 0, deficit: b.count })),
      deficits: poolFilter.buckets.map((b) => ({ ...b, available: 0, deficit: b.count })),
      fallbackUsed,
      emptyScope: true,
    };
  }

  const counts = await Promise.all(
    poolFilter.buckets.map((b) =>
      db.bankQuestion.count({
        where: {
          bankId: { in: poolFilter.bankIds },
          status: "published",
          cognitiveLevel: b.cognitiveLevel,
          difficulty: b.difficulty,
          type: { in: poolFilter.type as never },
          ...(poolFilter.skillIds && poolFilter.skillIds.length > 0
            ? { skillTags: { some: { skillId: { in: poolFilter.skillIds } } } }
            : {}),
        },
      }),
    ),
  );

  const buckets: BucketAvailability[] = poolFilter.buckets.map((b, i) => {
    const available = counts[i] ?? 0;
    return { ...b, available, deficit: Math.max(0, b.count - available) };
  });

  return {
    totalRequested: config.questionCount,
    totalAvailable: buckets.reduce((a, b) => a + Math.min(b.count, b.available), 0),
    bankIds: poolFilter.bankIds,
    skillIds: poolFilter.skillIds ?? [],
    buckets,
    deficits: buckets.filter((b) => b.deficit > 0),
    fallbackUsed,
    emptyScope: false,
  };
}
