import { prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditExam } from "../courses/authz";
import { ExamError } from "./types";
import { describeWeights, loadScoringPlan } from "./weighted-score";

/**
 * Danh sách kết quả của MỘT bài thi, gom mọi lượt làm bất kể thuộc ca nào
 * phòng nào.
 *
 * Trước đây câu hỏi "ai được mấy điểm" chỉ trả lời được qua Tổ chức thi → đợt →
 * ca → bảng kết quả, tức bắt giáo viên đi xuyên qua cấu trúc dữ liệu. Ở đây ca
 * và phòng tụt xuống thành bộ lọc.
 *
 * Hợp nhất hai kiểu người làm mà hệ thống có:
 *   - học viên đã ghi danh  → ExamAttempt.userId
 *   - thí sinh vào bằng mã  → ExamAttempt.candidateId
 * Hai bảng xuất hiện có sẵn mỗi bên chỉ phục vụ một kiểu, nên không bảng nào
 * dùng chung được.
 */

export type ExamResultRowStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "graded"
  | "flagged";

export interface ExamResultRow {
  /** Null khi học viên đã ghi danh nhưng chưa làm. */
  attemptId: string | null;
  displayName: string;
  /** Email (học viên ghi danh) hoặc mã dự thi (thí sinh vào bằng mã). */
  identifier: string | null;
  status: ExamResultRowStatus;
  score: number | null;
  scorePct: number | null;
  submittedAt: string | null;
  sessionId: string | null;
  sessionTitle: string | null;
  roomId: string | null;
  roomName: string | null;
  /** Còn câu chờ chấm tay trong bài này. */
  needsGrading: boolean;
  /** Tách điểm theo loại câu. Null khi chưa nộp (đang làm / chưa làm). */
  breakdown?: ExamResultBreakdown | null;
}

/**
 * Điểm của một bài tách theo hai loại câu: câu máy chấm (trắc nghiệm, điền
 * khuyết, ghép đôi…) và câu cần người chấm (tự luận, trả lời ngắn).
 *
 * "Đúng" của câu máy chấm nghĩa là đạt ĐỦ điểm của câu — câu có điểm từng phần
 * (chọn nhiều đáp án) mới đúng một phần thì chưa tính là đúng.
 */
export interface ExamResultBreakdown {
  objectiveCorrect: number;
  objectiveTotal: number;
  /** Tổng số câu tự luận / trả lời ngắn của đề. */
  essayTotal: number;
  /** Số câu thí sinh đã làm mà còn chờ chấm. */
  essayPending: number;
  /** Điểm tự luận đã chấm, trên tổng điểm các câu tự luận của đề. */
  essayScore: number;
  essayMax: number;
  /** Câu chờ chấm đầu tiên theo thứ tự đề — để link nhảy thẳng tới đó. */
  firstPendingQuestionId: string | null;
}

export interface ExamResultsSummary {
  /** Tổng số người CÓ THỂ làm: ghi danh + thí sinh được cấp mã. */
  expected: number;
  submitted: number;
  inProgress: number;
  notStarted: number;
  /** Trung bình % trên các bài đã chấm xong. Null khi chưa có bài nào. */
  avgScorePct: number | null;
  /** Số bài đã chấm xong làm cơ sở cho avgScorePct (không tính bài còn câu chờ chấm). */
  avgScoreCount: number;
  /** Số bài còn câu chờ chấm tay. */
  pendingGrading: number;
}

export interface ExamResults {
  examId: string;
  examTitle: string;
  totalPoints: number;
  /** "Phần 1 40% · Phần 2 60%" khi điểm % tính theo trọng số; null khi theo tỉ lệ điểm. */
  weightsNote: string | null;
  /** Chỉ hiện bộ lọc khi bài thực sự có nhiều hơn một. */
  sessions: Array<{ id: string; title: string }>;
  rooms: Array<{ id: string; name: string }>;
  /** Đề có câu máy chấm / câu cần chấm tay — quyết định cột nào hiện ở bảng. */
  hasObjective: boolean;
  hasEssay: boolean;
  summary: ExamResultsSummary;
  rows: ExamResultRow[];
}

export interface ExamResultsFilter {
  sessionId?: string;
  roomId?: string;
}

export function attemptResultStatus(s: string): ExamResultRowStatus {
  switch (s) {
    case "in_progress":
      return "in_progress";
    case "graded":
      return "graded";
    case "flagged":
      return "flagged";
    default:
      // submitted | auto_submitted — với giáo viên thì cùng nghĩa "đã nộp".
      return "submitted";
  }
}

export async function listExamResults(
  actorUserId: string,
  examId: string,
  filter: ExamResultsFilter = {},
  db: PrismaClient = prisma,
): Promise<ExamResults> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      courseId: true,
      createdById: true,
      title: true,
      accessMode: true,
      questions: { select: { id: true, type: true, points: true, orderInExam: true } },
      schedules: {
        select: { id: true, title: true, code: true, opensAt: true },
        orderBy: { opensAt: "asc" },
      },
    },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditExam(actorUserId, exam, db);

  const totalPoints = exam.questions.reduce((s, q) => s + q.points, 0);
  const isManual = (type: string) => type === "essay" || type === "short_answer";
  const manualQs = exam.questions.filter((q) => isManual(q.type));
  const objectiveQs = exam.questions.filter((q) => !isManual(q.type));
  const questionById = new Map(exam.questions.map((q) => [q.id, q]));
  const essayMax = manualQs.reduce((s, q) => s + q.points, 0);

  const rooms = await db.examRoom.findMany({
    where: { session: { examId } },
    select: { id: true, name: true },
    orderBy: { orderIndex: "asc" },
  });

  const attempts = await db.examAttempt.findMany({
    where: {
      examId,
      // Lọc theo ca đi qua HAI đường, không chỉ qua thí sinh:
      //   ExamAttempt.sessionId  — bài làm mới, mọi hình thức vào thi.
      //   candidate.sessionId    — bài làm cũ của thí sinh vào bằng mã.
      //
      // Bản cũ chỉ có `candidate: { sessionId }`. Học viên đã ghi danh KHÔNG
      // có ExamCandidate, nên bài của họ bị loại sạch: mở kết quả một ca kiểu
      // ghi danh thì bảng trống trơn, trông như chưa ai thi. Đúng lỗi user
      // báo ở Kỳ thi chính thức.
      ...(filter.sessionId
        ? {
            OR: [
              { sessionId: filter.sessionId },
              { sessionId: null, candidate: { sessionId: filter.sessionId } },
            ],
          }
        : {}),
      // Phòng thì vẫn chỉ qua thí sinh — bài của học viên ghi danh không xếp
      // phòng, nên lọc theo phòng loại chúng ra là đúng.
      ...(filter.roomId ? { candidate: { roomId: filter.roomId } } : {}),
    },
    orderBy: [{ submittedAt: "asc" }, { startedAt: "asc" }],
    select: {
      id: true,
      status: true,
      score: true,
      scorePct: true,
      submittedAt: true,
      userId: true,
      candidateDisplayName: true,
      sessionId: true,
      session: { select: { title: true, code: true } },
      user: { select: { displayName: true, email: true } },
      candidate: {
        select: {
          displayName: true,
          accessCode: true,
          sessionId: true,
          roomId: true,
          session: { select: { title: true, code: true } },
          room: { select: { name: true } },
        },
      },
      answers: {
        select: { questionId: true, autoScore: true, manualScore: true, needsGrading: true },
      },
    },
  });

  const rows: ExamResultRow[] = attempts.map((a) => ({
    attemptId: a.id,
    displayName:
      a.user?.displayName ??
      a.candidate?.displayName ??
      a.candidateDisplayName ??
      "(không tên)",
    identifier: a.user?.email ?? a.candidate?.accessCode ?? null,
    status: attemptResultStatus(a.status),
    score: a.score,
    scorePct: a.scorePct,
    submittedAt: a.submittedAt?.toISOString() ?? null,
    // Cột trên bài làm là nguồn chính; rơi về đường thí sinh cho bài làm cũ.
    sessionId: a.sessionId ?? a.candidate?.sessionId ?? null,
    sessionTitle:
      a.session?.title ??
      a.session?.code ??
      a.candidate?.session?.title ??
      a.candidate?.session?.code ??
      null,
    roomId: a.candidate?.roomId ?? null,
    roomName: a.candidate?.room?.name ?? null,
    needsGrading: a.answers.some((x) => x.needsGrading),
    breakdown:
      a.status === "in_progress"
        ? null
        : {
            objectiveCorrect: a.answers.filter((x) => {
              const q = questionById.get(x.questionId);
              return (
                q != null &&
                !isManual(q.type) &&
                x.autoScore != null &&
                x.autoScore >= q.points - 1e-9
              );
            }).length,
            objectiveTotal: objectiveQs.length,
            essayTotal: manualQs.length,
            essayPending: a.answers.filter(
              (x) => x.needsGrading && isManual(questionById.get(x.questionId)?.type ?? ""),
            ).length,
            essayScore: a.answers.reduce(
              (sum, x) =>
                isManual(questionById.get(x.questionId)?.type ?? "")
                  ? sum + (x.manualScore ?? 0)
                  : sum,
              0,
            ),
            essayMax,
            firstPendingQuestionId:
              a.answers
                .filter(
                  (x) => x.needsGrading && isManual(questionById.get(x.questionId)?.type ?? ""),
                )
                .map((x) => questionById.get(x.questionId)!)
                .sort((p, q) => p.orderInExam - q.orderInExam)[0]?.id ?? null,
          },
  }));

  // "Chưa làm" chỉ tính được khi có danh sách gốc để đối chiếu. Với đề mở bằng
  // mã thì không có danh sách đó — người lạ vào lúc nào cũng được — nên bỏ qua
  // thay vì bịa ra một con số sai.
  const seenUserIds = new Set(attempts.map((a) => a.userId).filter(Boolean));
  let notStartedRows: ExamResultRow[] = [];
  // Đề không gắn khoá học không dùng accessMode=authenticated (xem
  // assertEligibleForExam) nên exam.courseId luôn có giá trị ở nhánh này —
  // guard courseId chỉ để TypeScript hài lòng, không phải logic mới.
  if (
    exam.accessMode === "authenticated" &&
    exam.courseId &&
    !filter.sessionId &&
    !filter.roomId
  ) {
    const enrolled = await db.enrollment.findMany({
      where: { courseId: exam.courseId },
      select: { user: { select: { id: true, displayName: true, email: true } } },
    });
    notStartedRows = enrolled
      .filter((e) => !seenUserIds.has(e.user.id))
      .map((e) => ({
        attemptId: null,
        displayName: e.user.displayName,
        identifier: e.user.email,
        status: "not_started" as const,
        score: null,
        scorePct: null,
        submittedAt: null,
        sessionId: null,
        sessionTitle: null,
        roomId: null,
        roomName: null,
        needsGrading: false,
        breakdown: null,
      }));
  }

  const all = [...rows, ...notStartedRows];
  // Bài còn câu chờ chấm chưa có điểm cuối — đưa vào trung bình sẽ kéo con số
  // xuống bằng điểm của phần trắc nghiệm.
  const graded = rows.filter((r) => r.scorePct !== null && !r.needsGrading);
  const summary: ExamResultsSummary = {
    expected: all.length,
    submitted: rows.filter((r) => r.status !== "in_progress").length,
    inProgress: rows.filter((r) => r.status === "in_progress").length,
    notStarted: notStartedRows.length,
    avgScorePct:
      graded.length > 0
        ? graded.reduce((s, r) => s + (r.scorePct ?? 0), 0) / graded.length
        : null,
    avgScoreCount: graded.length,
    pendingGrading: rows.filter((r) => r.needsGrading).length,
  };

  return {
    examId: exam.id,
    examTitle: exam.title,
    totalPoints,
    weightsNote: describeWeights(await loadScoringPlan(examId, db)),
    sessions: exam.schedules.map((s) => ({
      id: s.id,
      title: s.title ?? s.code ?? "Ca thi",
    })),
    rooms,
    hasObjective: objectiveQs.length > 0,
    hasEssay: manualQs.length > 0,
    summary,
    rows: all,
  };
}
