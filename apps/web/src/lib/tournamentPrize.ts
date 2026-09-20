// Luật thuần cho phần giải thưởng của đấu trường (tổng XP + tỷ lệ chia theo hạng).

import { prizeXpForPercent } from "@feedbackme/core-gamification";

export const PRIZE_PRESETS: { id: string; label: string; percents: number[] }[] = [
  { id: "top1", label: "Chỉ hạng 1", percents: [100] },
  { id: "top3", label: "Top 3 (50, 30, 20)", percents: [50, 30, 20] },
  { id: "top5", label: "Top 5 (40, 25, 15, 10, 10)", percents: [40, 25, 15, 10, 10] },
];

export type PrizeErrors = { prizeXp?: string; distribution?: string };

const sum = (pcts: string[]) => Math.round(pcts.reduce((a, p) => a + (Number(p) || 0), 0) * 100) / 100;

export function validatePrize(prizeXp: string, pcts: string[]): PrizeErrors {
  const errors: PrizeErrors = {};
  if (!/^\d+$/.test(prizeXp.trim())) {
    errors.prizeXp = "Nhập số XP là số nguyên từ 0 trở lên (0 nghĩa là không có thưởng).";
    return errors;
  }
  if (Number(prizeXp) === 0) return errors;

  if (pcts.some((p) => p.trim() === "" || !Number.isFinite(Number(p)) || Number(p) < 0 || Number(p) > 100)) {
    errors.distribution = "Mỗi hạng phải là một số từ 0 đến 100.";
    return errors;
  }
  const total = sum(pcts);
  if (total > 100) errors.distribution = `Tổng tỷ lệ đang là ${total}%, vượt 100%. Giảm bớt để tổng đúng 100%.`;
  else if (total < 100) errors.distribution = `Tổng tỷ lệ mới là ${total}%, chưa đủ 100%. Phần còn lại sẽ không ai nhận.`;
  return errors;
}

export function buildPrizePayload(
  prizeXp: string,
  pcts: string[],
): { prizeXp: number; prizeDistribution: Record<string, number> | null } {
  const xp = Math.round(Number(prizeXp));
  if (xp === 0) return { prizeXp: 0, prizeDistribution: null };
  const dist: Record<string, number> = {};
  pcts.forEach((p, i) => {
    const n = Number(p) || 0;
    if (n > 0) dist[String(i + 1)] = n;
  });
  return { prizeXp: xp, prizeDistribution: dist };
}

export function prizeRows(prizeXp: number, pcts: string[]): { rank: number; percent: number; xp: number }[] {
  return pcts.map((p, i) => {
    const percent = Number(p) || 0;
    return { rank: i + 1, percent, xp: prizeXpForPercent(prizeXp, percent) };
  });
}

export function percentsFromDistribution(dist: Record<string, number> | null | undefined): string[] {
  if (!dist) return [];
  const entries = Object.entries(dist).sort(([a], [b]) => Number(a) - Number(b));
  if (entries.length === 0) return [];
  const max = Math.max(...entries.map(([k]) => Number(k)));
  const out: string[] = Array.from({ length: max }, () => "0");
  for (const [k, v] of entries) out[Number(k) - 1] = String(v);
  return out;
}
