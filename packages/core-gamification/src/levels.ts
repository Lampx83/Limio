/**
 * Level thresholds (XP required to reach level N) — Phase 1, 5 tiers.
 * Spec §5.2 has 10 tiers up to 8000 XP; we ship the simpler ramp for Phase 1
 * so demo users reach level 2-3 organically. Re-tunable via this single array.
 */
export const LEVEL_THRESHOLDS = [0, 200, 500, 1500, 3500] as const;
export const LEVEL_NAMES = ["Newcomer", "Engaged", "Dedicated", "Expert", "Master"] as const;

export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

export function computeLevel(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]!) level = i + 1;
  }
  return level;
}

export function levelName(level: number): string {
  return LEVEL_NAMES[level - 1] ?? `Level ${level}`;
}

/**
 * XP threshold to reach the next level. Returns null if already at MAX_LEVEL.
 */
export function nextLevelXp(currentLevel: number): number | null {
  if (currentLevel >= MAX_LEVEL) return null;
  return LEVEL_THRESHOLDS[currentLevel] ?? null;
}
