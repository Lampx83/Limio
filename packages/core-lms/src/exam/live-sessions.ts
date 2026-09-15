import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { isSessionOpen } from "./session-window";
import type { RevealPolicy } from "./reveal-policy";

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
  courseId: string | null;
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
  revealAnswers: RevealPolicy | null;
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
        // Vấn đáp AI có màn Live/Chấm bài riêng (xem OralSessionControl,
        // /exams/[examId]/live) — không đi qua danh sách "lần thi" của thi
        // viết dù ca của nó vô tình trùng scale với ca thi viết.
        kind: "written",
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

  // Đếm lượt của TỪNG ca.
  //
  // Hai đường về ca, cộng một đường lui cho dữ liệu cũ:
  //   ExamAttempt.sessionId   — bài làm mới, mọi hình thức vào thi.
  //   candidate.sessionId     — bài làm cũ của thí sinh vào bằng mã; cột này
  //                             vốn bắt buộc nên luôn truy được.
  //   examId (đường lui)      — chỉ dùng cho ca kiểu ghi danh mà KHÔNG đếm
  //                             được gì theo hai đường trên.
  //
  // Đường lui tồn tại vì học viên đã ghi danh không có ExamCandidate, và
  // ExamAttempt.sessionId mới có từ 26/08/2026 — bài làm trước đó không có
  // đường nào về ca. Đếm theo đề thì rộng (một gói đề chạy nhiều ca ghi danh
  // cùng lúc sẽ ra số trùng), nhưng thà rộng còn hơn hiện 0 và làm giáo viên
  // tưởng chưa ai thi. Dữ liệu mới không bao giờ chạm tới đường này.
  const perSession = await Promise.all(
    open.map(async (r) => {
      const scoped = {
        OR: [
          { sessionId: r.id },
          { sessionId: null, candidate: { sessionId: r.id } },
        ],
      };
      const graded: Prisma.EnumExamAttemptStatusFilter = {
        in: ["submitted", "auto_submitted", "graded"],
      };

      let started = await db.examAttempt.count({ where: scoped });
      let submitted = await db.examAttempt.count({
        where: { ...scoped, status: graded },
      });

      if (started === 0 && r.accessMode === "authenticated") {
        const legacy = { examId: r.exam.id };
        started = await db.examAttempt.count({ where: legacy });
        submitted = await db.examAttempt.count({
          where: { ...legacy, status: graded },
        });
      }

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
