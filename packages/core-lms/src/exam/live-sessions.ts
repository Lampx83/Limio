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
  /** Null khi lần thi không dùng mã dự thi chung (mã cấp riêng, hoặc ghi danh). */
  code: string | null;
  /** Null khi không có mã chung để phát. */
  path: string | null;
  /** open_code | assigned_code | authenticated — quyết định cách thí sinh vào. */
  accessMode: string;
  scale: "simple" | "formal";
  timingMode: "scheduled" | "manual";
  /** Null với ca thủ công — nó đóng khi giáo viên bấm. */
  closesAt: string | null;
  durationMin: number;
  /** Null = ca này theo chính sách của gói đề. Xem reveal-policy.ts. */
  revealAnswers: "immediately" | "never" | "after_close" | null;
  startedCount: number;
  submittedCount: number;
}

export async function listExamRuns(
  actorUserId: string,
  opts: {
    limit?: number;
    /**
     * Lọc theo mục đích của BUỔI THI — đo học sinh hay đo câu hỏi.
     * Buổi không tự khai thì tính theo gói đề.
     */
    purpose?: "assessment" | "field_test";
    /** Lọc theo quy mô tổ chức — một buổi đơn giản hay kỳ thi nhiều ca. */
    scale?: "simple" | "formal";
  } = {},
  db: PrismaClient = prisma,
): Promise<ExamRun[]> {
  const rows = await db.examSession.findMany({
    where: {
      // MỌI lần thi, không chỉ lần phát bằng link nhanh. Lọc theo openCode như
      // trước sẽ giấu mất toàn bộ kỳ thi tổ chức theo đường đợt/ca/phòng — nơi
      // thí sinh dùng mã cấp riêng hoặc vào bằng tài khoản đã ghi danh.
      ...(opts.scale ? { scale: opts.scale } : {}),
      // Mục đích của BUỔI thắng; buổi để trống thì rơi về gói đề. Lọc thẳng
      // trên exam.purpose như trước sẽ bỏ sót đúng trường hợp sinh ra cột
      // này: gói đề bình thường đem đi thử nghiệm.
      ...(opts.purpose
        ? {
            OR: [
              { purpose: opts.purpose },
              { purpose: null, exam: { purpose: opts.purpose } },
            ],
          }
        : {}),
      exam: {
        status: { not: "archived" },
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
      accessMode: true,
      scale: true,
      revealAnswers: true,
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

  // Đếm lượt theo từng ca. Thí sinh vào bằng mã gắn với ca qua ExamCandidate;
  // còn học viên đã ghi danh thì KHÔNG có candidate, nên lần thi kiểu đó đếm
  // theo đề. Không hoàn hảo khi một gói đề chạy nhiều ca cùng lúc theo kiểu ghi
  // danh, nhưng thà đếm rộng còn hơn hiện 0 và làm giáo viên tưởng chưa ai làm.
  const perSession = await Promise.all(
    open.map(async (r) => {
      const byCandidate = r.accessMode !== "authenticated";
      const where = byCandidate
        ? { candidate: { sessionId: r.id } }
        : { examId: r.exam.id };
      const started = await db.examAttempt.count({ where });
      const submitted = await db.examAttempt.count({
        where: {
          ...where,
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
    code: r.openCode,
    path: r.openCode ? `/exam/${r.openCode}` : null,
    accessMode: r.accessMode,
    scale: r.scale,
    timingMode: r.timingMode,
    closesAt: r.closesAt?.toISOString() ?? null,
    durationMin: r.durationOverrideMin ?? r.exam.durationMin,
    // null = ca này theo gói đề; UI hiện nhãn kế thừa chứ không đoán hộ.
    revealAnswers: r.revealAnswers,
    startedCount: countById.get(r.id)?.started ?? 0,
    submittedCount: countById.get(r.id)?.submitted ?? 0,
  }));
}
