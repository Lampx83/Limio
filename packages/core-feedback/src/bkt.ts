/**
 * Bayesian Knowledge Tracing — pure math. Per spec §4.1:
 *
 *   On observing a CORRECT answer:
 *     P(L_t | correct)   = P(L_t)·(1 - P_S) / [ P(L_t)·(1 - P_S) + (1 - P(L_t))·P_G ]
 *
 *   On observing an INCORRECT answer:
 *     P(L_t | incorrect) = P(L_t)·P_S       / [ P(L_t)·P_S       + (1 - P(L_t))·(1 - P_G) ]
 *
 *   Then:
 *     P(L_{t+1}) = P(L_t | observation) + (1 - P(L_t | observation)) · P_T
 *
 * Defaults are conservative starting values — fine for Phase 2 cold start.
 * Tunable per skill in Phase 4 once we have data.
 */
export const BKT = {
  /** Initial mastery prior P(L_0) — assume not yet mastered. */
  P_L0: 0.1,
  /** Transition probability — chance per observation that the learner just learned. */
  P_T: 0.1,
  /** Slip probability — chance the learner knows but slipped. */
  P_S: 0.1,
  /** Guess probability — chance the learner doesn't know but guessed correctly. */
  P_G: 0.2,
} as const;

export interface BktUpdateResult {
  /** P(L_{t+1}) — the new mastery estimate. */
  newMastery: number;
  /** Pre-transition posterior P(L_t | observation), useful for diagnostics. */
  posterior: number;
}

/**
 * Update mastery for a single observed answer.
 * `priorMastery` should be the user's current `LearnerSkillState.masteryProbability`,
 * or `BKT.P_L0` if no record yet.
 */
export function updateMasteryBkt(
  priorMastery: number,
  isCorrect: boolean,
  params = BKT,
): BktUpdateResult {
  const pLt = clamp01(priorMastery);
  const pNotLt = 1 - pLt;

  let posterior: number;
  if (isCorrect) {
    const numerator = pLt * (1 - params.P_S);
    const denominator = numerator + pNotLt * params.P_G;
    posterior = denominator === 0 ? pLt : numerator / denominator;
  } else {
    const numerator = pLt * params.P_S;
    const denominator = numerator + pNotLt * (1 - params.P_G);
    posterior = denominator === 0 ? pLt : numerator / denominator;
  }

  // Apply transition: chance the learner just acquired the skill from this observation.
  const newMastery = clamp01(posterior + (1 - posterior) * params.P_T);
  return { newMastery, posterior };
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
