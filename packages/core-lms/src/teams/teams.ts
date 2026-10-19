/**
 * Nhóm cố định của một khoá học, dùng cho bài tập nộp theo nhóm.
 * Tiêu chí chấp nhận: docs/group-submission-AC.md (mục A, B).
 *
 * Mẫu lấy từ TournamentTeam (core-gamification/tournament.ts): trưởng nhóm tạo
 * nhóm → nhận mã → gửi mã cho thành viên. Khác ở hai chỗ:
 *  - kiểm tra "nhóm đầy" trong transaction có khoá dòng, không còn chạy đua;
 *  - mọi thay đổi ghi LearningEvent trong CÙNG transaction (CLAUDE.md §5.1).
 */
import { prisma, type PrismaClient, type Prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { assertCanEditCourse } from "../courses/authz";
import { isUserEnrolled } from "../learning/enroll";
import { emitEvent } from "../learning/events";

export class CourseTeamError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "course_not_found"
      | "not_enrolled"
      | "already_in_team"
      | "not_in_team"
      | "team_not_found"
      | "join_code_invalid"
      | "team_full"
      | "team_name_taken"
      | "teams_locked"
      | "not_captain",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

type Tx = Prisma.TransactionClient;

const NAME_MAX = 60;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // không có 0/O/1/I

function makeJoinCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

function normalizeName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length === 0 || name.length > NAME_MAX) throw new CourseTeamError("validation_failed");
  return name;
}

function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: string }).code === "P2002";
}

async function loadSettings(courseId: string, db: PrismaClient | Tx) {
  const c = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, teamMaxSize: true, teamsLockedAt: true },
  });
  if (!c) throw new CourseTeamError("course_not_found");
  return c;
}

/** Học viên thao tác trên nhóm: phải đã ghi danh, và danh sách chưa khoá. */
async function assertLearnerCanChangeTeams(userId: string, courseId: string, db: PrismaClient) {
  const c = await loadSettings(courseId, db);
  if (!(await isUserEnrolled(userId, courseId, db))) throw new CourseTeamError("not_enrolled");
  if (c.teamsLockedAt) throw new CourseTeamError("teams_locked");
  return c;
}

/** Khoá dòng nhóm trong transaction để các lượt vào nhóm đồng thời xếp hàng. */
async function lockTeamRow(tx: Tx, teamId: string) {
  await tx.$queryRaw`SELECT "id" FROM "CourseTeam" WHERE "id" = ${teamId} FOR UPDATE`;
}

/**
 * Gỡ một thành viên khỏi nhóm của họ trong khoá (dùng chung cho rời nhóm, bị
 * mời ra, GV chuyển/gỡ). Trưởng nhóm đi thì quyền chuyển cho người vào sớm nhất;
 * nhóm rỗng bị xoá nếu chưa có bài nộp, ngược lại giữ lại để lịch sử chấm còn.
 */
async function detachMember(
  tx: Tx,
  courseId: string,
  userId: string,
): Promise<{ teamId: string; teamDeleted: boolean; newCaptainId: string | null } | null> {
  const membership = await tx.courseTeamMember.findUnique({
    where: { courseId_userId: { courseId, userId } },
    include: { team: { select: { id: true, captainId: true } } },
  });
  if (!membership) return null;
  const teamId = membership.teamId;
  await lockTeamRow(tx, teamId);
  await tx.courseTeamMember.delete({ where: { id: membership.id } });

  const remaining = await tx.courseTeamMember.findMany({
    where: { teamId },
    orderBy: { joinedAt: "asc" },
    select: { userId: true },
  });
  if (remaining.length === 0) {
    const hasSubmissions = (await tx.assignmentSubmission.count({ where: { teamId } })) > 0;
    if (hasSubmissions) {
      await tx.courseTeam.update({ where: { id: teamId }, data: { captainId: null } });
      return { teamId, teamDeleted: false, newCaptainId: null };
    }
    await tx.courseTeam.delete({ where: { id: teamId } });
    return { teamId, teamDeleted: true, newCaptainId: null };
  }
  if (membership.team.captainId === userId || membership.team.captainId === null) {
    const next = remaining[0]!.userId;
    await tx.courseTeam.update({ where: { id: teamId }, data: { captainId: next } });
    return { teamId, teamDeleted: false, newCaptainId: next };
  }
  return { teamId, teamDeleted: false, newCaptainId: null };
}

async function emitCaptainChanged(tx: Tx, courseId: string, teamId: string, newCaptainId: string | null, actorId: string) {
  if (!newCaptainId) return;
  await emitEvent(
    newCaptainId,
    LearningEventType.CourseTeamCaptainChanged,
    { teamId, actorId },
    { courseId },
    tx,
  );
}

// ─── Học viên ─────────────────────────────────────────────────────────────

export interface MyCourseTeam {
  settings: { teamMaxSize: number | null; locked: boolean };
  team: {
    id: string;
    name: string;
    joinCode: string;
    captainId: string | null;
    members: { userId: string; displayName: string; joinedAt: Date }[];
  } | null;
}

/** Nhóm của chính học viên trong khoá. Mã nhóm chỉ trả về cho thành viên. */
export async function getMyCourseTeam(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<MyCourseTeam> {
  const c = await loadSettings(courseId, db);
  const membership = await db.courseTeamMember.findUnique({
    where: { courseId_userId: { courseId, userId } },
    select: {
      team: {
        select: {
          id: true,
          name: true,
          joinCode: true,
          captainId: true,
          members: {
            orderBy: { joinedAt: "asc" },
            select: { userId: true, joinedAt: true, user: { select: { displayName: true } } },
          },
        },
      },
    },
  });
  const settings = { teamMaxSize: c.teamMaxSize, locked: c.teamsLockedAt !== null };
  if (!membership) return { settings, team: null };
  const t = membership.team;
  return {
    settings,
    team: {
      id: t.id,
      name: t.name,
      joinCode: t.joinCode,
      captainId: t.captainId,
      members: t.members.map((m) => ({ userId: m.userId, displayName: m.user.displayName, joinedAt: m.joinedAt })),
    },
  };
}

export async function createCourseTeam(
  userId: string,
  courseId: string,
  rawName: string,
  db: PrismaClient = prisma,
): Promise<{ teamId: string; joinCode: string }> {
  await assertLearnerCanChangeTeams(userId, courseId, db);
  const name = normalizeName(rawName);

  for (let attempt = 0; attempt < 5; attempt++) {
    const joinCode = makeJoinCode();
    try {
      return await db.$transaction(async (tx) => {
        const existing = await tx.courseTeamMember.findUnique({
          where: { courseId_userId: { courseId, userId } },
          select: { id: true },
        });
        if (existing) throw new CourseTeamError("already_in_team");
        const taken = await tx.courseTeam.findUnique({
          where: { courseId_name: { courseId, name } },
          select: { id: true },
        });
        if (taken) throw new CourseTeamError("team_name_taken");

        const team = await tx.courseTeam.create({ data: { courseId, name, captainId: userId, joinCode } });
        await tx.courseTeamMember.create({ data: { teamId: team.id, courseId, userId } });
        await emitEvent(userId, LearningEventType.CourseTeamCreated, { teamId: team.id }, { courseId }, tx);
        return { teamId: team.id, joinCode: team.joinCode };
      });
    } catch (e) {
      if (e instanceof CourseTeamError) throw e;
      if (!isUniqueViolation(e)) throw e;
      // P2002: trùng mã (thử mã khác), hoặc chạy đua trùng tên / đã vào nhóm khác.
      const target = String((e as { meta?: { target?: unknown } }).meta?.target ?? "");
      if (target.includes("name")) throw new CourseTeamError("team_name_taken");
      if (target.includes("userId")) throw new CourseTeamError("already_in_team");
    }
  }
  throw new CourseTeamError("validation_failed");
}

export async function joinCourseTeamByCode(
  userId: string,
  courseId: string,
  rawCode: string,
  db: PrismaClient = prisma,
): Promise<{ teamId: string }> {
  const c = await assertLearnerCanChangeTeams(userId, courseId, db);
  const code = rawCode.trim().toUpperCase();
  const team = await db.courseTeam.findUnique({ where: { joinCode: code }, select: { id: true, courseId: true } });
  // Mã của nhóm ở khoá khác cũng báo "không tìm thấy" — không lộ nhóm khoá khác.
  if (!team || team.courseId !== courseId) throw new CourseTeamError("join_code_invalid");

  try {
    await db.$transaction(async (tx) => {
      await lockTeamRow(tx, team.id);
      const existing = await tx.courseTeamMember.findUnique({
        where: { courseId_userId: { courseId, userId } },
        select: { id: true },
      });
      if (existing) throw new CourseTeamError("already_in_team");
      if (c.teamMaxSize !== null) {
        const count = await tx.courseTeamMember.count({ where: { teamId: team.id } });
        if (count >= c.teamMaxSize) throw new CourseTeamError("team_full", { teamMaxSize: c.teamMaxSize });
      }
      await tx.courseTeamMember.create({ data: { teamId: team.id, courseId, userId } });
      await emitEvent(userId, LearningEventType.CourseTeamJoined, { teamId: team.id }, { courseId }, tx);
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new CourseTeamError("already_in_team");
    throw e;
  }
  return { teamId: team.id };
}

export async function leaveCourseTeam(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertLearnerCanChangeTeams(userId, courseId, db);
  await db.$transaction(async (tx) => {
    const r = await detachMember(tx, courseId, userId);
    if (!r) throw new CourseTeamError("not_in_team");
    await emitEvent(
      userId,
      LearningEventType.CourseTeamLeft,
      { teamId: r.teamId, teamDeleted: r.teamDeleted },
      { courseId },
      tx,
    );
    await emitCaptainChanged(tx, courseId, r.teamId, r.newCaptainId, userId);
  });
}

async function loadCaptainTeam(userId: string, courseId: string, db: PrismaClient | Tx) {
  const membership = await db.courseTeamMember.findUnique({
    where: { courseId_userId: { courseId, userId } },
    select: { team: { select: { id: true, captainId: true } } },
  });
  if (!membership) throw new CourseTeamError("not_in_team");
  if (membership.team.captainId !== userId) throw new CourseTeamError("not_captain");
  return membership.team;
}

export async function regenerateCourseTeamCode(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<{ joinCode: string }> {
  await assertLearnerCanChangeTeams(userId, courseId, db);
  const team = await loadCaptainTeam(userId, courseId, db);
  for (let attempt = 0; attempt < 5; attempt++) {
    const joinCode = makeJoinCode();
    try {
      await db.$transaction(async (tx) => {
        await tx.courseTeam.update({ where: { id: team.id }, data: { joinCode } });
        await emitEvent(userId, LearningEventType.CourseTeamCodeRegenerated, { teamId: team.id }, { courseId }, tx);
      });
      return { joinCode };
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  throw new CourseTeamError("validation_failed");
}

/**
 * Đổi tên nhóm trong transaction: tên mới không trùng nhóm khác của khoá, giữ
 * nguyên tên (sau khi chuẩn hoá khoảng trắng) thì không ghi gì.
 */
async function applyRename(
  db: PrismaClient,
  courseId: string,
  teamId: string,
  rawName: string,
  actorId: string,
  subjectUserId: string,
): Promise<{ name: string }> {
  const name = normalizeName(rawName);
  try {
    return await db.$transaction(async (tx) => {
      const team = await tx.courseTeam.findUnique({ where: { id: teamId }, select: { name: true, courseId: true } });
      if (!team || team.courseId !== courseId) throw new CourseTeamError("team_not_found");
      if (team.name === name) return { name };
      const taken = await tx.courseTeam.findUnique({
        where: { courseId_name: { courseId, name } },
        select: { id: true },
      });
      if (taken && taken.id !== teamId) throw new CourseTeamError("team_name_taken");
      await tx.courseTeam.update({ where: { id: teamId }, data: { name } });
      await emitEvent(
        subjectUserId,
        LearningEventType.CourseTeamRenamed,
        { teamId, from: team.name, to: name, actorId },
        { courseId },
        tx,
      );
      return { name };
    });
  } catch (e) {
    // Chạy đua: một nhóm khác vừa lấy đúng tên này.
    if (isUniqueViolation(e)) throw new CourseTeamError("team_name_taken");
    throw e;
  }
}

/** Trưởng nhóm đổi tên nhóm của mình — chỉ khi danh sách chưa khoá. */
export async function renameCourseTeam(
  userId: string,
  courseId: string,
  rawName: string,
  db: PrismaClient = prisma,
): Promise<{ name: string }> {
  await assertLearnerCanChangeTeams(userId, courseId, db);
  const team = await loadCaptainTeam(userId, courseId, db);
  return applyRename(db, courseId, team.id, rawName, userId, userId);
}

/** Trưởng nhóm mời một thành viên ra khỏi nhóm (A5). */
export async function removeCourseTeamMember(
  captainId: string,
  courseId: string,
  targetUserId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  if (captainId === targetUserId) throw new CourseTeamError("validation_failed");
  await assertLearnerCanChangeTeams(captainId, courseId, db);
  const team = await loadCaptainTeam(captainId, courseId, db);
  await db.$transaction(async (tx) => {
    const target = await tx.courseTeamMember.findUnique({
      where: { courseId_userId: { courseId, userId: targetUserId } },
      select: { teamId: true },
    });
    if (!target || target.teamId !== team.id) throw new CourseTeamError("not_in_team");
    const r = await detachMember(tx, courseId, targetUserId);
    await emitEvent(
      targetUserId,
      LearningEventType.CourseTeamLeft,
      { teamId: team.id, teamDeleted: r?.teamDeleted ?? false, removedBy: captainId },
      { courseId },
      tx,
    );
  });
}

// ─── Giảng viên ───────────────────────────────────────────────────────────

const SettingsInput = {
  parse(raw: { teamMaxSize?: number | null; locked?: boolean }) {
    if (raw.teamMaxSize !== undefined && raw.teamMaxSize !== null) {
      if (!Number.isInteger(raw.teamMaxSize) || raw.teamMaxSize < 1 || raw.teamMaxSize > 50) {
        throw new CourseTeamError("validation_failed", "team_max_size_out_of_range");
      }
    }
    if (raw.locked !== undefined && typeof raw.locked !== "boolean") {
      throw new CourseTeamError("validation_failed");
    }
    return raw;
  },
};

export async function updateCourseTeamSettings(
  instructorId: string,
  courseId: string,
  raw: { teamMaxSize?: number | null; locked?: boolean },
  db: PrismaClient = prisma,
): Promise<{ teamMaxSize: number | null; locked: boolean }> {
  await assertCanEditCourse(instructorId, courseId, db);
  const input = SettingsInput.parse(raw);
  return db.$transaction(async (tx) => {
    const before = await loadSettings(courseId, tx);
    const lockedNow = before.teamsLockedAt !== null;
    const updated = await tx.course.update({
      where: { id: courseId },
      data: {
        ...(input.teamMaxSize !== undefined && { teamMaxSize: input.teamMaxSize }),
        ...(input.locked !== undefined &&
          input.locked !== lockedNow && { teamsLockedAt: input.locked ? new Date() : null }),
      },
      select: { teamMaxSize: true, teamsLockedAt: true },
    });
    const result = { teamMaxSize: updated.teamMaxSize, locked: updated.teamsLockedAt !== null };
    await emitEvent(instructorId, LearningEventType.CourseTeamsSettingsChanged, result, { courseId }, tx);
    return result;
  });
}

export interface CourseTeamsOverview {
  settings: { teamMaxSize: number | null; locked: boolean };
  teams: {
    id: string;
    name: string;
    joinCode: string;
    captainId: string | null;
    createdAt: Date;
    members: { userId: string; displayName: string; email: string; section: string | null; joinedAt: Date }[];
  }[];
  /** Học viên đang ghi danh (active/completed) chưa thuộc nhóm nào. */
  unassigned: { id: string; displayName: string; email: string; section: string | null }[];
}

export async function getCourseTeamsOverview(
  instructorId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<CourseTeamsOverview> {
  await assertCanEditCourse(instructorId, courseId, db);
  const c = await loadSettings(courseId, db);
  const [teams, enrollments] = await Promise.all([
    db.courseTeam.findMany({
      where: { courseId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        joinCode: true,
        captainId: true,
        createdAt: true,
        members: {
          orderBy: { joinedAt: "asc" },
          select: { userId: true, joinedAt: true, user: { select: { displayName: true, email: true } } },
        },
      },
    }),
    db.enrollment.findMany({
      where: { courseId, status: { in: ["active", "completed"] } },
      select: {
        user: { select: { id: true, displayName: true, email: true } },
        section: { select: { name: true, isDefault: true } },
      },
    }),
  ]);
  const sectionOf = new Map(
    enrollments.map((e) => [e.user.id, e.section && !e.section.isDefault ? e.section.name : null]),
  );
  const inTeam = new Set(teams.flatMap((t) => t.members.map((m) => m.userId)));
  return {
    settings: { teamMaxSize: c.teamMaxSize, locked: c.teamsLockedAt !== null },
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      joinCode: t.joinCode,
      captainId: t.captainId,
      createdAt: t.createdAt,
      members: t.members.map((m) => ({
        userId: m.userId,
        displayName: m.user.displayName,
        email: m.user.email,
        section: sectionOf.get(m.userId) ?? null,
        joinedAt: m.joinedAt,
      })),
    })),
    unassigned: enrollments
      .filter((e) => !inTeam.has(e.user.id))
      .map((e) => ({ ...e.user, section: sectionOf.get(e.user.id) ?? null }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "vi")),
  };
}

/**
 * GV chuyển một học viên sang nhóm khác (`toTeamId`), thêm học viên chưa có
 * nhóm, hoặc gỡ khỏi nhóm (`toTeamId = null`). Bỏ qua khoá danh sách và giới
 * hạn số người — đây là quyết định có chủ ý của GV.
 */
export async function instructorMoveTeamMember(
  instructorId: string,
  courseId: string,
  targetUserId: string,
  toTeamId: string | null,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertCanEditCourse(instructorId, courseId, db);
  if (!(await isUserEnrolled(targetUserId, courseId, db))) throw new CourseTeamError("not_enrolled");
  if (toTeamId) {
    const t = await db.courseTeam.findUnique({ where: { id: toTeamId }, select: { courseId: true } });
    if (!t || t.courseId !== courseId) throw new CourseTeamError("team_not_found");
  }
  await db.$transaction(async (tx) => {
    const current = await tx.courseTeamMember.findUnique({
      where: { courseId_userId: { courseId, userId: targetUserId } },
      select: { teamId: true },
    });
    const fromTeamId = current?.teamId ?? null;
    if (fromTeamId === toTeamId) return;
    const r = fromTeamId ? await detachMember(tx, courseId, targetUserId) : null;
    if (toTeamId) {
      await lockTeamRow(tx, toTeamId);
      await tx.courseTeamMember.create({ data: { teamId: toTeamId, courseId, userId: targetUserId } });
      // Nhóm đích đang không có trưởng nhóm (rỗng còn giữ lại) → người này làm trưởng nhóm.
      await tx.courseTeam.updateMany({ where: { id: toTeamId, captainId: null }, data: { captainId: targetUserId } });
    }
    await emitEvent(
      targetUserId,
      LearningEventType.CourseTeamMemberMoved,
      { actorId: instructorId, fromTeamId, toTeamId, fromTeamDeleted: r?.teamDeleted ?? false },
      { courseId },
      tx,
    );
    if (r) await emitCaptainChanged(tx, courseId, r.teamId, r.newCaptainId, instructorId);
  });
}

export async function instructorSetTeamCaptain(
  instructorId: string,
  courseId: string,
  teamId: string,
  newCaptainId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertCanEditCourse(instructorId, courseId, db);
  await db.$transaction(async (tx) => {
    const m = await tx.courseTeamMember.findUnique({
      where: { courseId_userId: { courseId, userId: newCaptainId } },
      select: { teamId: true },
    });
    if (!m || m.teamId !== teamId) throw new CourseTeamError("not_in_team");
    await tx.courseTeam.update({ where: { id: teamId }, data: { captainId: newCaptainId } });
    await emitCaptainChanged(tx, courseId, teamId, newCaptainId, instructorId);
  });
}

/** GV đổi tên bất kỳ nhóm nào của khoá — kể cả khi danh sách đã khoá. */
export async function instructorRenameCourseTeam(
  instructorId: string,
  courseId: string,
  teamId: string,
  rawName: string,
  db: PrismaClient = prisma,
): Promise<{ name: string }> {
  await assertCanEditCourse(instructorId, courseId, db);
  return applyRename(db, courseId, teamId, rawName, instructorId, instructorId);
}

/** Nhóm hiện tại của học viên trong khoá, kèm danh sách thành viên — dùng khi nộp bài nhóm. */
export async function getUserTeamInCourse(
  userId: string,
  courseId: string,
  db: PrismaClient | Tx = prisma,
): Promise<{ teamId: string; memberIds: string[] } | null> {
  const m = await db.courseTeamMember.findUnique({
    where: { courseId_userId: { courseId, userId } },
    select: { team: { select: { id: true, members: { select: { userId: true } } } } },
  });
  if (!m) return null;
  return { teamId: m.team.id, memberIds: m.team.members.map((x) => x.userId) };
}
