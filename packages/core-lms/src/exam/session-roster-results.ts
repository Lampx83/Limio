/**
 * Kết quả của MỘT ca thi, mỗi dòng MỘT thí sinh — nguồn cho file "Bảng điểm ca
 * thi" (Excel).
 *
 * Khác listExamResults (mỗi dòng một LƯỢT làm bài, chỉ có người đã vào thi):
 *   - đủ danh sách thí sinh của ca, kể cả em chưa vào thi hoặc chưa có phòng;
 *   - học viên vào bằng tài khoản mà không có ExamCandidate cũng có một dòng;
 *   - nhiều lượt ⇒ lấy lượt nộp gần nhất (chưa nộp lượt nào thì lượt đang làm
 *     gần nhất), giống quy tắc file đợt thi cũ, kèm số lượt;
 *   - có mã lớp học, mã lớp thi.
 *
 * Mã lớp lấy theo thứ tự tin cậy, không đoán:
 *   lớp thi: mã đã ghi vào thí sinh → tên phòng nếu đó là một lớp thi của khoá.
 *   lớp học: lớp ghi vào thí sinh → lớp sở hữu lớp thi → lớp đang ghi danh
 *            (bỏ lớp mặc định) → chữ "Lớp" ghi tay cũ (metadata.class).
 */

import { prisma, type PrismaClient } from "@feedbackme/db";
import { canEditSession } from "./exam-rounds";
import { attemptResultStatus, type ExamResultRowStatus } from "./results";
import { ExamError } from "./types";

export interface SessionRosterRow {
  displayName: string;
  mssv: string | null;
  email: string | null;
  cohortCode: string | null;
  examClassCode: string | null;
  roomName: string | null;
  accessCode: string | null;
  status: ExamResultRowStatus;
  /** Lượt được tính điểm; null khi chưa vào thi. */
  attemptId: string | null;
  attemptCount: number;
  /** Số lần rời tab (sự cố `tab_blur`) của lượt được tính điểm; chưa vào thi thì 0. */
  tabSwitchCount: number;
  score: number | null;
  scorePct: number | null;
  submittedAt: string | null;
  needsGrading: boolean;
}

export interface SessionRosterResults {
  examId: string;
  examTitle: string;
  sessionTitle: string;
  totalPoints: number;
  rows: SessionRosterRow[];
}

interface AttemptLite {
  id: string;
  status: string;
  startedAt: Date;
  submittedAt: Date | null;
  score: number | null;
  scorePct: number | null;
  answers: Array<{ needsGrading: boolean }>;
  _count: { incidents: number };
}

/** Lượt nộp gần nhất; chưa nộp lượt nào thì lượt mới bắt đầu gần nhất. */
function pickAttempt(attempts: AttemptLite[]): AttemptLite | null {
  const submitted = attempts
    .filter((a) => a.status !== "in_progress" && a.submittedAt)
    .sort((a, b) => b.submittedAt!.getTime() - a.submittedAt!.getTime());
  if (submitted[0]) return submitted[0];
  return [...attempts].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0] ?? null;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const givenName = (n: string) => n.trim().split(/\s+/).pop() ?? n;

export async function listSessionRosterResults(
  actorUserId: string,
  sessionId: string,
  db: PrismaClient = prisma,
): Promise<SessionRosterResults> {
  const s = await db.examSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      roundId: true,
      examId: true,
      title: true,
      code: true,
      exam: { select: { title: true, courseId: true, questions: { select: { points: true } } } },
    },
  });
  if (!s) throw new ExamError("schedule_not_found");
  if (!(await canEditSession(actorUserId, { roundId: s.roundId, examId: s.examId }, db)))
    throw new ExamError("forbidden");
  const courseId = s.exam.courseId;

  const attemptSelect = {
    id: true,
    status: true,
    startedAt: true,
    submittedAt: true,
    score: true,
    scorePct: true,
    answers: { select: { needsGrading: true } },
    _count: { select: { incidents: { where: { type: "tab_blur" } } } },
  } as const;

  const [candidates, accountAttempts, examClasses, sections] = await Promise.all([
    db.examCandidate.findMany({
      where: { sessionId },
      select: {
        displayName: true,
        accessCode: true,
        metadata: true,
        userId: true,
        room: { select: { name: true } },
        cohort: { select: { code: true, name: true } },
        linkedUser: { select: { email: true, studentCode: true } },
        attempts: { select: attemptSelect },
      },
    }),
    // Học viên vào bằng tài khoản ở ca này mà không qua danh sách thí sinh.
    db.examAttempt.findMany({
      where: { examId: s.examId, sessionId, candidateId: null, userId: { not: null } },
      select: { ...attemptSelect, userId: true, user: { select: { displayName: true, email: true, studentCode: true } } },
    }),
    courseId
      ? db.cohortExamClass.findMany({
          where: { courseId },
          select: { code: true, cohort: { select: { code: true, name: true } } },
        })
      : Promise.resolve([]),
    courseId
      ? db.courseSection.findMany({ where: { courseId }, select: { id: true, code: true, name: true, isDefault: true } })
      : Promise.resolve([]),
  ]);

  const classLabel = (c: { code: string | null; name: string }) => c.code ?? c.name;
  const examClassCohort = new Map(examClasses.map((e) => [e.code.toUpperCase(), classLabel(e.cohort)]));
  const sectionLabel = new Map(sections.filter((x) => !x.isDefault).map((x) => [x.id, classLabel(x)]));

  // Lớp đang ghi danh của mọi người có tài khoản trong ca — một truy vấn.
  const userIds = [
    ...new Set([
      ...candidates.map((c) => c.userId).filter((x): x is string => !!x),
      ...accountAttempts.map((a) => a.userId!),
    ]),
  ];
  const enrollments =
    courseId && userIds.length
      ? await db.enrollment.findMany({
          where: { courseId, userId: { in: userIds } },
          select: { userId: true, sectionId: true },
        })
      : [];
  const enrolledClass = new Map(
    enrollments.map((e) => [e.userId, sectionLabel.get(e.sectionId) ?? null] as const),
  );

  const toRow = (
    base: Omit<SessionRosterRow, "status" | "attemptId" | "attemptCount" | "tabSwitchCount" | "score" | "scorePct" | "submittedAt" | "needsGrading">,
    attempts: AttemptLite[],
  ): SessionRosterRow => {
    const a = pickAttempt(attempts);
    return {
      ...base,
      status: a ? attemptResultStatus(a.status) : "not_started",
      attemptId: a?.id ?? null,
      attemptCount: attempts.length,
      tabSwitchCount: a?._count.incidents ?? 0,
      score: a?.score ?? null,
      scorePct: a?.scorePct ?? null,
      submittedAt: a?.submittedAt?.toISOString() ?? null,
      needsGrading: a ? a.answers.some((x) => x.needsGrading) : false,
    };
  };

  const rows: SessionRosterRow[] = candidates.map((c) => {
    const md = (c.metadata && typeof c.metadata === "object" ? c.metadata : {}) as Record<string, unknown>;
    const roomName = c.room?.name ?? null;
    const examClassCode =
      str(md.examClassCode) ?? (roomName && examClassCohort.has(roomName.toUpperCase()) ? roomName : null);
    const cohortCode =
      (c.cohort ? classLabel(c.cohort) : null) ??
      (examClassCode ? (examClassCohort.get(examClassCode.toUpperCase()) ?? null) : null) ??
      (c.userId ? (enrolledClass.get(c.userId) ?? null) : null) ??
      str(md.class);
    return toRow(
      {
        displayName: c.displayName,
        mssv: str(md.studentCode) ?? str(c.linkedUser?.studentCode),
        email: (str(md.email) ?? c.linkedUser?.email ?? null)?.toLowerCase() ?? null,
        cohortCode,
        examClassCode,
        roomName,
        accessCode: c.accessCode,
      },
      c.attempts,
    );
  });

  const byUser = new Map<string, typeof accountAttempts>();
  for (const a of accountAttempts) byUser.set(a.userId!, [...(byUser.get(a.userId!) ?? []), a]);
  for (const [userId, attempts] of byUser) {
    const u = attempts[0]!.user!;
    rows.push(
      toRow(
        {
          displayName: u.displayName,
          mssv: str(u.studentCode),
          email: u.email.toLowerCase(),
          cohortCode: enrolledClass.get(userId) ?? null,
          examClassCode: null,
          roomName: null,
          accessCode: null,
        },
        attempts,
      ),
    );
  }

  // Theo lớp thi (chưa có lớp thi xuống cuối), rồi tên riêng kiểu Việt.
  rows.sort(
    (a, b) =>
      (a.examClassCode === null ? 1 : 0) - (b.examClassCode === null ? 1 : 0) ||
      (a.examClassCode ?? "").localeCompare(b.examClassCode ?? "", "vi", { numeric: true }) ||
      givenName(a.displayName).localeCompare(givenName(b.displayName), "vi") ||
      a.displayName.localeCompare(b.displayName, "vi"),
  );

  return {
    examId: s.examId,
    examTitle: s.exam.title,
    sessionTitle: s.title ?? s.code ?? "Ca thi",
    totalPoints: s.exam.questions.reduce((sum, q) => sum + q.points, 0),
    rows,
  };
}
