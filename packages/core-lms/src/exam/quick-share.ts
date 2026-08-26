import { prisma, type PrismaClient } from "@feedbackme/db";
import type { RevealPolicy } from "./reveal-policy";
import { assertCanEditCourse } from "../courses/authz";
import { generateOpenCode } from "./code-access";
import { ensureDefaultRound, ensureDefaultRoomForSession } from "./exam-rooms";
import { ExamError } from "./types";

/**
 * "Mở buổi thi" — gộp mọi thứ cần để một bài kiểm tra sẵn sàng cho học sinh vào
 * MỘT hành động.
 *
 * Trước đây giáo viên phải: publish đề → sang tab Truy cập → đổi chế độ sang
 * mã mở → bấm sinh mã → (hoặc đi lối Tổ chức thi: tạo đợt → tạo ca → tạo
 * phòng) → copy link. Tám bước cho việc mà họ nghĩ là "gửi cái link cho lớp".
 *
 * Cấu trúc đợt/ca/phòng vẫn được dựng đầy đủ bên dưới — chỉ là giáo viên không
 * phải học nó. `ensureDefault*` đã tồn tại sẵn cho đúng mục đích này.
 *
 * Idempotent: gọi lại trên buổi đã mở thì trả về đúng mã cũ, không sinh
 * mã mới. Muốn đổi mã thì dùng nút "Sinh mã mới" riêng.
 */
export async function shareExamLink(
  actorUserId: string,
  examId: string,
  opts: {
    timingMode?: "scheduled" | "manual";
    /** Thời lượng làm bài của BUỔI THI này. Bỏ trống = theo mặc định của gói đề. */
    durationMin?: number;
    /** Chỉ dùng khi timingMode = "scheduled". */
    opensAt?: Date;
    closesAt?: Date;
    /** Quy mô tổ chức — mặc định "simple" vì hàm này phục vụ luồng mở nhanh. */
    scale?: "simple" | "formal";
    /**
     * Khi nào học sinh được xem đáp án. Bỏ trống = theo gói đề.
     * Xem reveal-policy.ts.
     */
    revealAnswers?: RevealPolicy;
  } = {},
  db: PrismaClient = prisma,
): Promise<{
  code: string;
  path: string;
  sessionId: string;
  published: boolean;
  reusedExistingCode: boolean;
}> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      courseId: true,
      status: true,
      openAt: true,
      closeAt: true,
      _count: { select: { questions: true } },
    },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditCourse(actorUserId, exam.courseId, db);

  if (exam.status === "archived") throw new ExamError("exam_not_draft");
  if (
    opts.timingMode === "scheduled" &&
    opts.opensAt &&
    opts.closesAt &&
    opts.opensAt >= opts.closesAt
  ) {
    throw new ExamError("validation_failed", {
      reason: "bad_window",
      message: "Giờ mở phải trước giờ đóng.",
    });
  }
  if (exam._count.questions === 0) {
    throw new ExamError("validation_failed", {
      reason: "no_questions",
      message: "Thêm ít nhất một câu hỏi trước khi mở buổi thi.",
    });
  }

  // Ca đã có mã thì dùng lại — bấm hai lần không được đổi mã dưới chân học
  // sinh đang chờ.
  const existing = await db.examSession.findFirst({
    where: { examId, accessMode: "open_code", openCode: { not: null } },
    select: { id: true, openCode: true },
    orderBy: { createdAt: "asc" },
  });

  const published = exam.status !== "published";
  if (published) {
    await db.exam.update({
      where: { id: examId },
      data: { status: "published", publishedAt: new Date() },
    });
  }
  // Đề vào bằng mã thì cửa sổ của ĐỀ không còn chặn ai (ca quyết định), nhưng
  // accessMode vẫn phải khớp để nhánh legacy không từ chối.
  await db.exam.update({
    where: { id: examId },
    data: { accessMode: "open_code" },
  });

  if (existing?.openCode) {
    return {
      code: existing.openCode,
      path: `/exam/${existing.openCode}`,
      sessionId: existing.id,
      published,
      reusedExistingCode: true,
    };
  }

  const roundId = await ensureDefaultRound(examId, db);
  const manual = (opts.timingMode ?? "manual") === "manual";

  // 31^6 ≈ 887 triệu tổ hợp nên đụng mã gần như không xảy ra, nhưng vẫn thử lại.
  for (let i = 0; i < 5; i++) {
    const code = generateOpenCode();
    try {
      const s = await db.examSession.create({
        data: {
          examId,
          roundId,
          accessMode: "open_code",
          openCode: code,
          timingMode: manual ? "manual" : "scheduled",
          // Ca thủ công mở NGAY; status là nguồn sự thật, mốc giờ chỉ để hiển thị.
          status: manual ? "open" : "draft",
          opensAt: manual ? new Date() : (opts.opensAt ?? exam.openAt),
          closesAt: manual ? null : (opts.closesAt ?? exam.closeAt),
          // Thời lượng thuộc BUỔI THI, không thuộc gói đề: cùng một gói có thể
          // chạy 15 phút ở lớp này và 30 phút ở lớp kia (kéo dài cho HS cần
          // hỗ trợ). Exam.durationMin chỉ còn là giá trị mặc định.
          durationOverrideMin: opts.durationMin ?? null,
          scale: opts.scale ?? "simple",
          revealAnswers: opts.revealAnswers ?? null,
        },
        select: { id: true },
      });
      await ensureDefaultRoomForSession(actorUserId, s.id, db);
      return {
        code,
        path: `/exam/${code}`,
        sessionId: s.id,
        published,
        reusedExistingCode: false,
      };
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
      // đụng mã — thử mã khác
    }
  }
  throw new ExamError("validation_failed", { reason: "openCode_collision" });
}
