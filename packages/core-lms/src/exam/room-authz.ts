/**
 * P1 — Room-scoped authz for proctor + grader roles. Builds on top of
 * `canEditCourse` (instructor = full access).
 *
 * Proctor (giám thị) of a room can:
 *   - Read the live-monitor stream, filtered to candidates in their room.
 *   - View the candidate roster of their room.
 *   Cannot grade, edit exam, or see other rooms.
 *
 * Grader (người chấm) of a room can:
 *   - Read essay/short-answer answers for candidates in their rooms.
 *   - Submit manual scores for those answers.
 *   Cannot proctor, edit exam, or see other rooms.
 *
 * Instructor (course owner / co-instructor / admin) — full access. Bypasses
 * all room scoping.
 *
 * Note: roomIds returned from `effectiveRoomsForUser` are an empty array for
 * instructors (since they have full access, no scoping is needed — callers
 * should branch on `isInstructor` first).
 */

import { prisma, type PrismaClient } from "@feedbackme/db";
import { canEditCourse } from "../courses/authz";

export interface RoomScope {
  // Instructor / admin — sees everything. Other fields ignored.
  isInstructor: boolean;
  // Rooms the user proctors in this exam.
  proctorRoomIds: string[];
  // Rooms the user grades in this exam.
  graderRoomIds: string[];
}

/**
 * Resolve the user's scope on a given exam. Returns a discriminated payload
 * the caller can branch on: instructor (full access), proctor (filter to
 * proctorRoomIds), grader (filter to graderRoomIds), or "no access" (all
 * three falsy / empty).
 */
export async function getRoomScope(
  userId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<RoomScope & { hasAnyAccess: boolean }> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true },
  });
  if (!exam) {
    return {
      isInstructor: false,
      proctorRoomIds: [],
      graderRoomIds: [],
      hasAnyAccess: false,
    };
  }

  const [isInstructor, proctorRooms, graderRows] = await Promise.all([
    canEditCourse(userId, exam.courseId, db),
    db.examRoom.findMany({
      where: { examId, proctorUserId: userId },
      select: { id: true },
    }),
    db.examRoomGrader.findMany({
      where: { userId, room: { examId } },
      select: { roomId: true },
    }),
  ]);

  const proctorRoomIds = proctorRooms.map((r) => r.id);
  const graderRoomIds = graderRows.map((r) => r.roomId);
  return {
    isInstructor,
    proctorRoomIds,
    graderRoomIds,
    hasAnyAccess:
      isInstructor || proctorRoomIds.length > 0 || graderRoomIds.length > 0,
  };
}

/**
 * Resolve candidateIds the user is allowed to see for this exam.
 * Returns `null` for instructors (= all candidates, no filter).
 * Returns the set of candidateIds (proctor ∪ grader rooms) otherwise.
 */
export async function visibleCandidateIds(
  userId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<string[] | null> {
  const scope = await getRoomScope(userId, examId, db);
  if (scope.isInstructor) return null;
  const roomIds = [
    ...new Set([...scope.proctorRoomIds, ...scope.graderRoomIds]),
  ];
  if (roomIds.length === 0) return [];
  const candidates = await db.examCandidate.findMany({
    where: { examId, roomId: { in: roomIds } },
    select: { id: true },
  });
  return candidates.map((c) => c.id);
}
