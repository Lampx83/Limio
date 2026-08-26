import { prisma, type PrismaClient } from "@feedbackme/db";
import { isSessionOpen } from "./session-window";

/**
 * Các LẦN THI của một giảng viên — đang mở và gần đây.
 *
 * Sau khi tách gói đề khỏi buổi thi, buổi thi là một danh từ độc lập: có thời
 * lượng riêng, giờ riêng, mã riêng, thí sinh riêng. Danh sách này là NHÀ của nó
 * — không phải bản sao của mục "Đề thi".
 *
 * Phân công rõ để hai nơi không giẫm chân nhau:
 *   - Đề thi → tab Kết quả  = "gói đề này chạy ra sao" (gộp mọi lần, lọc theo ca)
 *   - Tổ chức thi → lần thi = "buổi hôm đó ra sao" (một lần chạy cụ thể)
 */
export interface ExamRun {
  sessionId: string;
  /** Còn cho học sinh vào không. */
  isOpen: boolean;
  opensAt: string;
  examId: string;
  courseId: string;
  examTitle: string;
  code: string;
  path: string;
  timingMode: "scheduled" | "manual";
  /** Null với ca thủ công — nó đóng khi giáo viên bấm. */
  closesAt: string | null;
  durationMin: number;
  startedCount: number;
  submittedCount: number;
}

export async function listExamRuns(
  actorUserId: string,
  opts: { limit?: number } = {},
  db: PrismaClient = prisma,
): Promise<ExamRun[]> {
  const rows = await db.examSession.findMany({
    where: {
      openCode: { not: null },
      accessMode: "open_code",
      exam: {
        status: "published",
        course: { instructors: { some: { userId: actorUserId } } },
      },
    },
    select: {
      id: true,
      openCode: true,
      opensAt: true,
      closesAt: true,
      timingMode: true,
      status: true,
      durationOverrideMin: true,
      exam: {
        select: { id: true, title: true, courseId: true, durationMin: true },
      },
    },
    orderBy: { opensAt: "desc" },
    take: opts.limit ?? 30,
  });
  if (rows.length === 0) return [];

  const now = new Date();
  const open = rows;

  // Đếm lượt theo từng ca. Thí sinh vào bằng mã được gắn sessionId qua
  // ExamCandidate, nên đếm qua đó thay vì qua examId (một gói đề có thể đang
  // chạy nhiều buổi cùng lúc).
  const perSession = await Promise.all(
    open.map(async (r) => {
      const started = await db.examAttempt.count({
        where: { candidate: { sessionId: r.id } },
      });
      const submitted = await db.examAttempt.count({
        where: {
          candidate: { sessionId: r.id },
          status: { in: ["submitted", "auto_submitted", "graded"] },
        },
      });
      return { id: r.id, started, submitted };
    }),
  );
  const countById = new Map(perSession.map((x) => [x.id, x]));

  return open.map((r) => ({
    sessionId: r.id,
    isOpen: isSessionOpen(r, now),
    opensAt: r.opensAt.toISOString(),
    examId: r.exam.id,
    courseId: r.exam.courseId,
    examTitle: r.exam.title,
    code: r.openCode!,
    path: `/exam/${r.openCode}`,
    timingMode: r.timingMode,
    closesAt: r.closesAt?.toISOString() ?? null,
    durationMin: r.durationOverrideMin ?? r.exam.durationMin,
    startedCount: countById.get(r.id)?.started ?? 0,
    submittedCount: countById.get(r.id)?.submitted ?? 0,
  }));
}
