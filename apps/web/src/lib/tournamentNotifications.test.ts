import { describe, expect, it } from "vitest";
import { buildTournamentNotifications, type TournamentNotifInput } from "./tournamentNotifications";

const NOW = new Date("2026-10-05T03:00:00Z");
const h = (n: number) => new Date(NOW.getTime() + n * 3_600_000);
const day = (n: number) => h(n * 24);

const T = (over: Partial<TournamentNotifInput["registrations"][number]["tournament"]> = {}) => ({
  id: "t1",
  title: "Đại số sprint",
  status: "published",
  startsAt: day(10),
  endsAt: day(20),
  teamSize: 1,
  ...over,
});

function input(over: Partial<TournamentNotifInput> = {}): TournamentNotifInput {
  return {
    userId: "me",
    registrations: [],
    teammateJoins: [],
    missions: [],
    submittedKeys: new Set(),
    myRankings: [],
    prizes: [],
    cancelledTournaments: new Map(),
    ...over,
  };
}

const reg = (t = T(), over = {}) => ({ registeredAt: h(-2), teamId: null, teamName: null, captainId: null, tournament: t, ...over });
const byType = (list: ReturnType<typeof buildTournamentNotifications>, type: string) => list.filter((n) => n.type === type);

describe("buildTournamentNotifications", () => {
  it("đăng ký thành công", () => {
    const n = byType(buildTournamentNotifications(input({ registrations: [reg()] }), NOW), "tournament.registered");
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ title: "Bạn đã đăng ký đấu trường", body: "Đại số sprint", link: "/tournaments/t1" });
    expect(n[0]!.createdAt).toEqual(h(-2));
  });

  it("có người vào đội của bạn", () => {
    const n = byType(
      buildTournamentNotifications(
        input({
          registrations: [reg(T({ teamSize: 3 }), { teamId: "tm", teamName: "Số Nguyên Tố" })],
          teammateJoins: [{ id: "r9", tournamentId: "t1", teamName: "Số Nguyên Tố", displayName: "Minh Quân", registeredAt: h(-1) }],
        }),
        NOW,
      ),
      "tournament.team.joined",
    );
    expect(n).toHaveLength(1);
    expect(n[0]!.title).toBe("Minh Quân đã vào đội Số Nguyên Tố");
  });

  it("sắp bắt đầu: chỉ khi còn dưới 24 giờ", () => {
    const soon = buildTournamentNotifications(input({ registrations: [reg(T({ startsAt: h(5) }))] }), NOW);
    expect(byType(soon, "tournament.starting_soon")).toHaveLength(1);
    expect(byType(soon, "tournament.starting_soon")[0]!.body).toMatch(/5 giờ/);
    const far = buildTournamentNotifications(input({ registrations: [reg(T({ startsAt: day(3) }))] }), NOW);
    expect(byType(far, "tournament.starting_soon")).toHaveLength(0);
  });

  it("đã bắt đầu trong 14 ngày gần đây", () => {
    const started = buildTournamentNotifications(input({ registrations: [reg(T({ status: "active", startsAt: day(-2), endsAt: day(9) }))] }), NOW);
    expect(byType(started, "tournament.started")).toHaveLength(1);
    const old = buildTournamentNotifications(input({ registrations: [reg(T({ status: "active", startsAt: day(-30), endsAt: day(9) }))] }), NOW);
    expect(byType(old, "tournament.started")).toHaveLength(0);
  });

  it("sắp hết hạn nộp: nhiệm vụ chưa nộp, hạn trong 24 giờ", () => {
    const active = T({ status: "active", startsAt: day(-2), endsAt: day(9) });
    const missions = [
      { id: "m1", title: "Bài kiểm tra nhanh", tournamentId: "t1", submissionDeadline: h(10), isTeamSubmission: false, isActionable: true },
      { id: "m2", title: "Đã nộp rồi", tournamentId: "t1", submissionDeadline: h(10), isTeamSubmission: false, isActionable: true },
      { id: "m3", title: "Hạn còn xa", tournamentId: "t1", submissionDeadline: day(5), isTeamSubmission: false, isActionable: true },
      { id: "m4", title: "Tự tính theo khoá", tournamentId: "t1", submissionDeadline: h(10), isTeamSubmission: false, isActionable: false },
    ];
    const n = byType(
      buildTournamentNotifications(input({ registrations: [reg(active)], missions, submittedKeys: new Set(["m2:me"]) }), NOW),
      "tournament.deadline_soon",
    );
    expect(n.map((x) => x.body)).toEqual(["Bài kiểm tra nhanh · còn 10 giờ"]);
    expect(n[0]!.link).toBe("/tournaments/t1/missions/m1");
  });

  it("nhiệm vụ nộp chung: thành viên thường không bị nhắc, đội trưởng bị nhắc; bài do đội trưởng nộp thì thôi nhắc", () => {
    const active = T({ status: "active", startsAt: day(-2), endsAt: day(9), teamSize: 3 });
    const m = [{ id: "m1", title: "Bài nhóm", tournamentId: "t1", submissionDeadline: h(6), isTeamSubmission: true, isActionable: true }];
    const asMember = buildTournamentNotifications(
      input({ registrations: [reg(active, { teamId: "tm", teamName: "A", captainId: "cap" })], missions: m }),
      NOW,
    );
    expect(byType(asMember, "tournament.deadline_soon")).toHaveLength(0);
    const asCaptain = buildTournamentNotifications(
      input({ registrations: [reg(active, { teamId: "tm", teamName: "A", captainId: "me" })], missions: m }),
      NOW,
    );
    expect(byType(asCaptain, "tournament.deadline_soon")).toHaveLength(1);
    const submitted = buildTournamentNotifications(
      input({ registrations: [reg(active, { teamId: "tm", teamName: "A", captainId: "me" })], missions: m, submittedKeys: new Set(["m1:me"]) }),
      NOW,
    );
    expect(byType(submitted, "tournament.deadline_soon")).toHaveLength(0);
  });

  it("kết thúc: nêu hạng; giải bị huỷ trước giờ bắt đầu thì báo huỷ, không nêu hạng", () => {
    const ended = T({ status: "ended", startsAt: day(-10), endsAt: day(-1) });
    const n = buildTournamentNotifications(input({ registrations: [reg(ended)], myRankings: [{ tournamentId: "t1", rank: 2, totalPoints: 250 }] }), NOW);
    expect(byType(n, "tournament.ended")[0]).toMatchObject({ title: "Đấu trường đã kết thúc", body: "Đại số sprint · bạn hạng 2, 250 điểm" });
    const cancelled = buildTournamentNotifications(
      input({ registrations: [reg(ended)], cancelledTournaments: new Map([["t1", day(-1)]]) }),
      NOW,
    );
    expect(byType(cancelled, "tournament.cancelled")).toHaveLength(1);
    expect(byType(cancelled, "tournament.ended")).toHaveLength(0);
  });

  it("giải huỷ trước giờ bắt đầu (endsAt vẫn ở tương lai) vẫn hiện thông báo huỷ đúng lúc huỷ", () => {
    const cancelledEarly = T({ status: "ended", startsAt: day(3), endsAt: day(10) });
    const n = buildTournamentNotifications(
      input({ registrations: [reg(cancelledEarly)], cancelledTournaments: new Map([["t1", h(-1)]]) }),
      NOW,
    );
    expect(byType(n, "tournament.cancelled")).toHaveLength(1);
    expect(byType(n, "tournament.cancelled")[0]!.createdAt).toEqual(h(-1));
  });

  it("kết thúc không có hạng thì vẫn báo kết thúc", () => {
    const ended = T({ status: "ended", startsAt: day(-10), endsAt: day(-1) });
    const n = buildTournamentNotifications(input({ registrations: [reg(ended)] }), NOW);
    expect(byType(n, "tournament.ended")[0]!.body).toBe("Đại số sprint");
  });

  it("nhận thưởng XP", () => {
    const ended = T({ status: "ended", startsAt: day(-10), endsAt: day(-1) });
    const n = buildTournamentNotifications(
      input({ registrations: [reg(ended)], prizes: [{ id: "x1", tournamentId: "t1", amount: 150, occurredAt: day(-1) }] }),
      NOW,
    );
    expect(byType(n, "tournament.prize")[0]).toMatchObject({ title: "Bạn nhận 150 XP thưởng", body: "Đại số sprint" });
  });

  it("thông báo tương lai không xuất hiện và kết quả sắp mới nhất trước", () => {
    const list = buildTournamentNotifications(
      input({ registrations: [reg(T({ startsAt: h(5) })), reg(T({ id: "t2", title: "Khác", status: "active", startsAt: day(-1), endsAt: day(5) }))] }),
      NOW,
    );
    for (const n of list) expect(n.createdAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
    const times = list.map((n) => n.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
});
