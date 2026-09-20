// Thông báo đấu trường cho người chơi. Hệ thống thông báo hiện tại không lưu hàng riêng mà
// dựng từ dữ liệu khi mở chuông (xem notifications.ts), nên phần này cũng vậy:
// hàm thuần buildTournamentNotifications (dễ test) + hàm nạp dữ liệu từ DB.

import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import type { Notification } from "./notifications";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SOON_WINDOW = 24 * HOUR; // nhắc trước 24 giờ
const RECENT_STARTED = 14 * DAY;
const RECENT_ENDED = 30 * DAY;

export type TournamentNotifInput = {
  userId: string;
  registrations: {
    registeredAt: Date;
    teamId: string | null;
    teamName: string | null;
    captainId: string | null;
    tournament: { id: string; title: string; status: string; startsAt: Date; endsAt: Date; teamSize: number };
  }[];
  /** Người khác vừa vào đội của mình. */
  teammateJoins: { id: string; tournamentId: string; teamName: string; displayName: string; registeredAt: Date }[];
  /** Nhiệm vụ nộp bài của các giải mình đã đăng ký (không gồm loại tự tính theo khoá: isActionable=false). */
  missions: {
    id: string;
    title: string;
    tournamentId: string;
    submissionDeadline: Date | null;
    isTeamSubmission: boolean;
    isActionable: boolean;
  }[];
  /** `${missionId}:${userId người nộp}` — nhiệm vụ nộp chung tính theo đội trưởng. */
  submittedKeys: Set<string>;
  myRankings: { tournamentId: string; rank: number; totalPoints: number }[];
  prizes: { id: string; tournamentId: string; amount: number; occurredAt: Date }[];
  /** Giải bị huỷ trước giờ bắt đầu: id → lúc huỷ (lấy từ sự kiện kết thúc; endsAt vẫn là mốc dự kiến). */
  cancelledTournaments: Map<string, Date>;
};

function hoursLabel(ms: number): string {
  const hours = Math.max(1, Math.round(ms / HOUR));
  return hours >= 24 ? `${Math.floor(hours / 24)} ngày` : `${hours} giờ`;
}

export function buildTournamentNotifications(inp: TournamentNotifInput, now: Date): Notification[] {
  const out: Notification[] = [];
  const nowMs = now.getTime();
  const titleOf = new Map(inp.registrations.map((r) => [r.tournament.id, r.tournament.title]));
  const push = (n: Notification) => {
    if (n.createdAt.getTime() <= nowMs) out.push(n);
  };

  for (const r of inp.registrations) {
    const t = r.tournament;
    const link = `/tournaments/${t.id}`;
    const started = t.startsAt.getTime() <= nowMs;
    const cancelledAt = t.status === "ended" ? inp.cancelledTournaments.get(t.id) : undefined;
    const isCancelled = !!cancelledAt;

    push({
      id: `tn:reg:${t.id}`,
      type: "tournament.registered",
      title: "Bạn đã đăng ký đấu trường",
      body: t.title,
      link,
      iconKey: "tournament",
      createdAt: r.registeredAt,
    });

    // Sắp bắt đầu (còn dưới 24 giờ)
    if ((t.status === "published" || t.status === "active") && !started && t.startsAt.getTime() - nowMs <= SOON_WINDOW) {
      push({
        id: `tn:soon:${t.id}`,
        type: "tournament.starting_soon",
        title: "Đấu trường sắp bắt đầu",
        body: `${t.title} · sau ${hoursLabel(t.startsAt.getTime() - nowMs)}`,
        link,
        iconKey: "deadline",
        createdAt: new Date(t.startsAt.getTime() - SOON_WINDOW),
      });
    }

    // Đã bắt đầu
    if (started && nowMs - t.startsAt.getTime() <= RECENT_STARTED && !isCancelled) {
      push({
        id: `tn:start:${t.id}`,
        type: "tournament.started",
        title: "Đấu trường đã bắt đầu",
        body: t.title,
        link,
        iconKey: "tournament",
        createdAt: t.startsAt,
      });
    }

    // Kết thúc / huỷ
    if (t.status === "ended" && (isCancelled ? nowMs - cancelledAt!.getTime() : nowMs - t.endsAt.getTime()) <= RECENT_ENDED) {
      if (isCancelled) {
        push({
          id: `tn:cancel:${t.id}`,
          type: "tournament.cancelled",
          title: "Đấu trường đã bị huỷ",
          body: `${t.title} · giải bị huỷ trước giờ bắt đầu, không có thưởng`,
          link,
          iconKey: "tournament_cancel",
          createdAt: cancelledAt!,
        });
      } else {
        const rk = inp.myRankings.find((x) => x.tournamentId === t.id);
        push({
          id: `tn:end:${t.id}`,
          type: "tournament.ended",
          title: "Đấu trường đã kết thúc",
          body: rk ? `${t.title} · bạn hạng ${rk.rank}, ${rk.totalPoints} điểm` : t.title,
          link,
          iconKey: "tournament",
          createdAt: t.endsAt,
        });
      }
    }
  }

  // Có người vào đội của mình
  for (const j of inp.teammateJoins) {
    push({
      id: `tn:join:${j.id}`,
      type: "tournament.team.joined",
      title: `${j.displayName} đã vào đội ${j.teamName}`,
      body: titleOf.get(j.tournamentId),
      link: `/tournaments/${j.tournamentId}`,
      iconKey: "team",
      createdAt: j.registeredAt,
    });
  }

  // Sắp hết hạn nộp: nhiệm vụ nộp bài, hạn trong 24 giờ tới, chưa nộp
  for (const r of inp.registrations) {
    const t = r.tournament;
    if (t.status !== "active") continue;
    const isCaptain = !!r.teamId && r.captainId === inp.userId;
    for (const m of inp.missions.filter((x) => x.tournamentId === t.id)) {
      if (!m.isActionable || !m.submissionDeadline) continue;
      const left = m.submissionDeadline.getTime() - nowMs;
      if (left <= 0 || left > SOON_WINDOW) continue;
      if (m.isTeamSubmission && t.teamSize > 1) {
        if (!isCaptain) continue; // chỉ đội trưởng nộp được
      }
      const submitterId = m.isTeamSubmission && t.teamSize > 1 ? (r.captainId ?? inp.userId) : inp.userId;
      if (inp.submittedKeys.has(`${m.id}:${submitterId}`)) continue;
      push({
        id: `tn:dl:${m.id}`,
        type: "tournament.deadline_soon",
        title: "Nhiệm vụ sắp hết hạn nộp",
        body: `${m.title} · còn ${hoursLabel(left)}`,
        link: `/tournaments/${t.id}/missions/${m.id}`,
        iconKey: "deadline",
        createdAt: new Date(m.submissionDeadline.getTime() - SOON_WINDOW),
      });
    }
  }

  // Nhận thưởng
  for (const p of inp.prizes) {
    if (p.amount <= 0) continue;
    push({
      id: `tn:prize:${p.id}`,
      type: "tournament.prize",
      title: `Bạn nhận ${p.amount} XP thưởng`,
      body: titleOf.get(p.tournamentId),
      link: `/tournaments/${p.tournamentId}`,
      iconKey: "prize",
      createdAt: p.occurredAt,
    });
  }

  out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return out;
}

// ── Nạp dữ liệu ────────────────────────────────────────────────────────────

export async function getTournamentNotifications(userId: string, now = new Date()): Promise<Notification[]> {
  const regs = await prisma.tournamentRegistration.findMany({
    where: { userId, disqualifiedAt: null },
    orderBy: { registeredAt: "desc" },
    take: 20,
    select: {
      registeredAt: true,
      teamId: true,
      team: { select: { name: true, captainId: true } },
      tournament: {
        select: { id: true, title: true, status: true, startsAt: true, endsAt: true, teamSize: true },
      },
    },
  });
  if (regs.length === 0) return [];

  const tournamentIds = regs.map((r) => r.tournament.id);
  const myTeamIds = regs.map((r) => r.teamId).filter((x): x is string => !!x);
  const activeIds = regs.filter((r) => r.tournament.status === "active").map((r) => r.tournament.id);
  const endedIds = regs.filter((r) => r.tournament.status === "ended").map((r) => r.tournament.id);

  const [teamJoins, missions, rankings, prizes, endEvents] = await Promise.all([
    myTeamIds.length
      ? prisma.tournamentRegistration.findMany({
          where: { teamId: { in: myTeamIds }, userId: { not: userId } },
          orderBy: { registeredAt: "desc" },
          take: 20,
          select: {
            id: true,
            registeredAt: true,
            tournamentId: true,
            team: { select: { name: true } },
            user: { select: { displayName: true } },
          },
        })
      : Promise.resolve([]),
    activeIds.length
      ? prisma.tournamentMission.findMany({
          where: { tournamentId: { in: activeIds }, submissionDeadline: { gt: now } },
          select: { id: true, title: true, tournamentId: true, submissionDeadline: true, isTeamSubmission: true, verifyMode: true, missionType: true },
        })
      : Promise.resolve([]),
    endedIds.length
      ? prisma.tournamentRanking.findMany({
          where: {
            tournamentId: { in: endedIds },
            OR: [{ userId }, ...(myTeamIds.length ? [{ teamId: { in: myTeamIds } }] : [])],
          },
          select: { tournamentId: true, rank: true, totalPoints: true },
        })
      : Promise.resolve([]),
    prisma.xpTransaction.findMany({
      where: { userId, reason: "tournament.prize", amount: { gt: 0 } },
      orderBy: { occurredAt: "desc" },
      take: 10,
      select: { id: true, sourceId: true, amount: true, occurredAt: true },
    }),
    endedIds.length
      ? prisma.learningEvent.findMany({
          where: { eventType: LearningEventType.TournamentEnded, payload: { path: ["cancelledBeforeStart"], equals: true } },
          select: { payload: true, occurredAt: true },
          take: 50,
        })
      : Promise.resolve([]),
  ]);

  const missionIds = missions.map((m) => m.id);
  const captainIds = regs.map((r) => r.team?.captainId).filter((x): x is string => !!x);
  const subs = missionIds.length
    ? await prisma.missionSubmission.findMany({
        where: { missionId: { in: missionIds }, userId: { in: [userId, ...captainIds] } },
        select: { missionId: true, userId: true },
      })
    : [];

  const prizeTournamentIds = new Set(tournamentIds);
  const prizeRows = prizes
    .map((p) => {
      // sourceId = "tournament:{id}:rank-{n}[...]"
      const tid = p.sourceId?.split(":")[1];
      return tid && prizeTournamentIds.has(tid) ? { id: p.id, tournamentId: tid, amount: p.amount, occurredAt: p.occurredAt } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const cancelled = new Map<string, Date>();
  for (const e of endEvents) {
    const tid = (e.payload as { tournamentId?: string } | null)?.tournamentId;
    if (tid) cancelled.set(tid, e.occurredAt);
  }

  return buildTournamentNotifications(
    {
      userId,
      registrations: regs.map((r) => ({
        registeredAt: r.registeredAt,
        teamId: r.teamId,
        teamName: r.team?.name ?? null,
        captainId: r.team?.captainId ?? null,
        tournament: r.tournament,
      })),
      teammateJoins: teamJoins.map((j) => ({
        id: j.id,
        tournamentId: j.tournamentId,
        teamName: j.team?.name ?? "",
        displayName: j.user.displayName,
        registeredAt: j.registeredAt,
      })),
      missions: missions.map((m) => ({
        id: m.id,
        title: m.title,
        tournamentId: m.tournamentId,
        submissionDeadline: m.submissionDeadline,
        isTeamSubmission: m.isTeamSubmission,
        isActionable: !!m.missionType && m.missionType !== "COURSE_LINKED" && !!m.verifyMode,
      })),
      submittedKeys: new Set(subs.map((s) => `${s.missionId}:${s.userId}`)),
      myRankings: rankings,
      prizes: prizeRows,
      cancelledTournaments: cancelled,
    },
    now,
  );
}
