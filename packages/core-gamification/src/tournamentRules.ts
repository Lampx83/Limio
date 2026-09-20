// Luật thuần của đấu trường (không đụng DB) — dùng chung cho API, cron và giao diện
// để lời hứa trên màn hình và việc máy chủ thực sự làm luôn khớp nhau.

export type TournamentStatusLike = "draft" | "published" | "active" | "ended";

/** XP của một hạng. Máy chủ và giao diện phải dùng cùng hàm này (làm tròn xuống). */
export function prizeXpForPercent(prizeXp: number, percent: number): number {
  if (prizeXp <= 0 || percent <= 0) return 0;
  return Math.floor((prizeXp * percent) / 100);
}

type EndInput = { status: string; startsAt: Date; endsAt: Date };
export type TournamentEndPlan =
  | { ok: true; endsAt: Date; awardPrizes: boolean }
  | { ok: false; reason: "only_active_or_published_can_be_ended" };

/**
 * Kết thúc thủ công.
 *  - Đã bắt đầu (active, hoặc published nhưng quá giờ mở): chốt endsAt = bây giờ, trao thưởng.
 *  - Chưa bắt đầu (huỷ): giữ nguyên mốc thời gian, không trao thưởng — không ai đã thi đấu.
 */
export function planTournamentEnd(t: EndInput, now: Date): TournamentEndPlan {
  if (t.status !== "active" && t.status !== "published") {
    return { ok: false, reason: "only_active_or_published_can_be_ended" };
  }
  const started = t.status === "active" || now >= t.startsAt;
  return started
    ? { ok: true, endsAt: now, awardPrizes: true }
    : { ok: true, endsAt: t.endsAt, awardPrizes: false };
}

/** Có nhận bài nộp lúc này không: đã công bố/đang diễn ra và trong [startsAt, endsAt). */
export function isTournamentOpenForSubmission(
  t: { status: string; startsAt: Date; endsAt: Date },
  now: Date,
): boolean {
  if (t.status !== "published" && t.status !== "active") return false;
  return now >= t.startsAt && now < t.endsAt;
}

export type PatchCheck =
  | { ok: true }
  | { ok: false; reason: "tournament_ended" | "team_size_locked" };

/** Ai/khi nào được sửa những trường nào. `fields` là tên các trường trong body PATCH. */
export function canPatchTournament(
  t: { status: string; registrationCount: number },
  fields: string[],
): PatchCheck {
  if (t.status === "ended") return { ok: false, reason: "tournament_ended" };
  if (fields.includes("teamSize") && (t.status !== "draft" || t.registrationCount > 0)) {
    return { ok: false, reason: "team_size_locked" };
  }
  return { ok: true };
}

export type PrizeSetupIssue = "distribution_missing" | "sum_over_100" | null;

/** Có Prize XP thì phải chia tỷ lệ theo hạng, nếu không sẽ không ai nhận gì khi kết thúc. */
export function prizeSetupIssue(t: {
  prizeXp: number;
  prizeDistribution: unknown;
}): PrizeSetupIssue {
  if (t.prizeXp <= 0) return null;
  const dist = t.prizeDistribution;
  if (!dist || typeof dist !== "object") return "distribution_missing";
  const values = Object.values(dist as Record<string, unknown>).filter(
    (v): v is number => typeof v === "number" && v > 0,
  );
  if (values.length === 0) return "distribution_missing";
  const sum = values.reduce((a, b) => a + b, 0);
  return sum > 100 ? "sum_over_100" : null;
}

export type RankEntry = { key: string; points: number; lastAt: Date | null };

/**
 * Thứ tự xếp hạng: điểm cao hơn xếp trên; bằng điểm thì đạt được mức điểm đó SỚM hơn xếp trên
 * (lastAt = lúc hoàn thành nhiệm vụ gần nhất đóng góp điểm); vẫn bằng thì theo key cho ổn định.
 * Trước đây chỉ sắp theo điểm nên hai đội bằng điểm nhận hạng khác nhau theo thứ tự ngẫu nhiên,
 * kéo theo phần thưởng hạng 1/2/3 cũng ngẫu nhiên.
 */
export function sortRankEntries<T extends RankEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (a.lastAt && b.lastAt) {
      const d = a.lastAt.getTime() - b.lastAt.getTime();
      if (d !== 0) return d;
    } else if (a.lastAt) {
      return -1;
    } else if (b.lastAt) {
      return 1;
    }
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
}
