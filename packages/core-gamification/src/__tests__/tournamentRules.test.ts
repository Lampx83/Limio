import { describe, expect, it } from "vitest";
import {
  canPatchTournament,
  isTournamentOpenForSubmission,
  planTournamentEnd,
  prizeSetupIssue,
  prizeXpForPercent,
  sortRankEntries,
} from "../tournamentRules";

const T0 = new Date("2026-06-01T08:00:00Z");
const T1 = new Date("2026-06-08T08:00:00Z");
const during = new Date("2026-06-03T08:00:00Z");

describe("prizeXpForPercent", () => {
  it("làm tròn xuống, khớp cách trao thưởng của máy chủ", () => {
    expect(prizeXpForPercent(101, 50)).toBe(50);
    expect(prizeXpForPercent(500, 30)).toBe(150);
    expect(prizeXpForPercent(0, 50)).toBe(0);
    expect(prizeXpForPercent(100, 0)).toBe(0);
  });
});

describe("planTournamentEnd", () => {
  it("đang diễn ra: chốt endsAt = bây giờ và trao thưởng", () => {
    const plan = planTournamentEnd({ status: "active", startsAt: T0, endsAt: T1 }, during);
    expect(plan).toEqual({ ok: true, endsAt: during, awardPrizes: true });
  });

  it("đã công bố nhưng chưa bắt đầu (huỷ): giữ nguyên mốc thời gian, không trao thưởng", () => {
    const before = new Date("2026-05-30T08:00:00Z");
    const plan = planTournamentEnd({ status: "published", startsAt: T0, endsAt: T1 }, before);
    expect(plan).toEqual({ ok: true, endsAt: T1, awardPrizes: false });
  });

  it("đã công bố và quá giờ bắt đầu (cron chưa kịp chuyển): coi như đang diễn ra", () => {
    const plan = planTournamentEnd({ status: "published", startsAt: T0, endsAt: T1 }, during);
    expect(plan).toEqual({ ok: true, endsAt: during, awardPrizes: true });
  });

  it("nháp hoặc đã kết thúc: từ chối", () => {
    expect(planTournamentEnd({ status: "draft", startsAt: T0, endsAt: T1 }, during).ok).toBe(false);
    expect(planTournamentEnd({ status: "ended", startsAt: T0, endsAt: T1 }, during).ok).toBe(false);
  });
});

describe("isTournamentOpenForSubmission", () => {
  it("chỉ nhận bài trong khoảng [startsAt, endsAt) khi đã công bố hoặc đang diễn ra", () => {
    const base = { startsAt: T0, endsAt: T1 };
    expect(isTournamentOpenForSubmission({ ...base, status: "active" }, during)).toBe(true);
    expect(isTournamentOpenForSubmission({ ...base, status: "published" }, during)).toBe(true);
    expect(isTournamentOpenForSubmission({ ...base, status: "active" }, new Date("2026-05-30T00:00:00Z"))).toBe(false);
    expect(isTournamentOpenForSubmission({ ...base, status: "active" }, T1)).toBe(false);
    expect(isTournamentOpenForSubmission({ ...base, status: "ended" }, during)).toBe(false);
    expect(isTournamentOpenForSubmission({ ...base, status: "draft" }, during)).toBe(false);
  });
});

describe("canPatchTournament", () => {
  it("nháp: sửa tự do", () => {
    expect(canPatchTournament({ status: "draft", registrationCount: 0 }, ["teamSize", "startsAt"])).toEqual({ ok: true });
  });

  it("đã kết thúc: khoá hoàn toàn", () => {
    expect(canPatchTournament({ status: "ended", registrationCount: 5 }, ["title"])).toEqual({
      ok: false,
      reason: "tournament_ended",
    });
  });

  it("teamSize khoá khi đã công bố hoặc đã có người đăng ký", () => {
    expect(canPatchTournament({ status: "published", registrationCount: 0 }, ["teamSize"])).toEqual({
      ok: false,
      reason: "team_size_locked",
    });
    expect(canPatchTournament({ status: "draft", registrationCount: 2 }, ["teamSize"])).toEqual({
      ok: false,
      reason: "team_size_locked",
    });
  });

  it("đã công bố: vẫn sửa được tiêu đề, mô tả, thời gian, thưởng", () => {
    expect(
      canPatchTournament({ status: "published", registrationCount: 3 }, ["title", "description", "endsAt", "prizeXp"]),
    ).toEqual({ ok: true });
  });
});

describe("prizeSetupIssue", () => {
  it("có Prize XP mà chưa chia tỷ lệ: lỗi", () => {
    expect(prizeSetupIssue({ prizeXp: 500, prizeDistribution: null })).toBe("distribution_missing");
    expect(prizeSetupIssue({ prizeXp: 500, prizeDistribution: {} })).toBe("distribution_missing");
  });

  it("không có Prize XP thì không cần chia", () => {
    expect(prizeSetupIssue({ prizeXp: 0, prizeDistribution: null })).toBeNull();
  });

  it("tổng vượt 100% là lỗi, đủ hoặc thiếu thì hợp lệ", () => {
    expect(prizeSetupIssue({ prizeXp: 500, prizeDistribution: { "1": 60, "2": 50 } })).toBe("sum_over_100");
    expect(prizeSetupIssue({ prizeXp: 500, prizeDistribution: { "1": 50, "2": 30, "3": 20 } })).toBeNull();
    expect(prizeSetupIssue({ prizeXp: 500, prizeDistribution: { "1": 50 } })).toBeNull();
  });
});

describe("sortRankEntries", () => {
  const d = (h: number) => new Date(`2026-10-02T0${h}:00:00Z`);

  it("điểm cao hơn xếp trên", () => {
    const r = sortRankEntries([
      { key: "a", points: 100, lastAt: d(1) },
      { key: "b", points: 250, lastAt: d(5) },
    ]);
    expect(r.map((x) => x.key)).toEqual(["b", "a"]);
  });

  it("bằng điểm: đạt điểm đó sớm hơn xếp trên", () => {
    const r = sortRankEntries([
      { key: "late", points: 200, lastAt: d(5) },
      { key: "early", points: 200, lastAt: d(2) },
    ]);
    expect(r.map((x) => x.key)).toEqual(["early", "late"]);
  });

  it("bằng điểm và chưa có ai làm gì (0 điểm): thứ tự theo key, ổn định", () => {
    const r = sortRankEntries([
      { key: "c", points: 0, lastAt: null },
      { key: "a", points: 0, lastAt: null },
      { key: "b", points: 0, lastAt: null },
    ]);
    expect(r.map((x) => x.key)).toEqual(["a", "b", "c"]);
  });

  it("có mốc thời gian xếp trên không có mốc khi bằng điểm", () => {
    const r = sortRankEntries([
      { key: "x", points: 50, lastAt: null },
      { key: "y", points: 50, lastAt: d(3) },
    ]);
    expect(r.map((x) => x.key)).toEqual(["y", "x"]);
  });

  it("không đổi mảng gốc", () => {
    const input = [
      { key: "b", points: 1, lastAt: null },
      { key: "a", points: 2, lastAt: null },
    ];
    sortRankEntries(input);
    expect(input[0]!.key).toBe("b");
  });
});
