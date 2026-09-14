import { prisma, type PrismaClient } from "@feedbackme/db";
import type { RevealPolicy } from "./reveal-policy";
import { assertCanEditCourse } from "../courses/authz";
import { generateOpenCode } from "./code-access";
import { ensureDefaultRound, ensureDefaultRoomForSession } from "./exam-rooms";
import { isSessionOpen } from "./session-window";
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
 * Idempotent trong phạm vi MỘT buổi: gọi lại khi buổi cũ CÒN MỞ thì trả đúng
 * mã cũ, không sinh mã mới. Buổi cũ đã đóng thì đây là buổi MỚI — sinh mã mới.
 * Xem chi tiết ở chỗ chọn `existing` bên dưới.
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
    /**
     * Buổi này là đợt thử nghiệm câu hỏi hay bài thi thật.
     * Bỏ trống = theo gói đề.
     */
    purpose?: "assessment" | "field_test";
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
      purpose: true,
      kind: true,
      openAt: true,
      closeAt: true,
      _count: { select: { questions: true, oralMaterials: true } },
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
  // A6.3 — Vấn đáp AI không có ExamQuestion; điều kiện tối thiểu để mở buổi
  // thi là có tài liệu (giống điều kiện publishExam), không phải câu hỏi.
  if (exam.kind === "oral") {
    if (exam._count.oralMaterials === 0) {
      throw new ExamError("validation_failed", {
        reason: "no_materials",
        message: "Thêm ít nhất một tài liệu trước khi mở buổi thi.",
      });
    }
  } else if (exam._count.questions === 0) {
    throw new ExamError("validation_failed", {
      reason: "no_questions",
      message: "Thêm ít nhất một câu hỏi trước khi mở buổi thi.",
    });
  }

  // Chỉ dùng lại ca CÒN MỞ, và phải cùng kiểu hẹn giờ với thứ vừa chọn.
  //
  // Bản trước lấy `findFirst(... orderBy createdAt asc)` — tức ca CŨ NHẤT có
  // mã, bất kể đóng hay mở. Gói đề đã dùng lần trước thì lần này bấm "Mở" sẽ
  // trả về đúng cái ca đã đóng từ đời nào, kèm mã của nó; giáo viên tưởng vừa
  // mở buổi mới, học sinh vào thì báo "đề đã đóng". Mọi lựa chọn vừa đặt
  // (thời lượng, chính sách đáp án) cũng bị nuốt mất theo.
  //
  // Ý định ban đầu — "bấm hai lần không được đổi mã dưới chân học sinh đang
  // chờ" — vẫn giữ, nhưng nó chỉ đúng khi ca đó CÒN MỞ. Ca đã đóng nghĩa là
  // buổi thi đó xong rồi; bấm Mở lúc này là mở buổi MỚI, và cùng một gói đề
  // mở được nhiều buổi là điều cả màn hình này dựa vào.
  const now = new Date();
  const wantManual = (opts.timingMode ?? "manual") === "manual";
  const openCandidates = await db.examSession.findMany({
    where: { examId, accessMode: "open_code", openCode: { not: null } },
    select: {
      id: true,
      openCode: true,
      opensAt: true,
      closesAt: true,
      timingMode: true,
      status: true,
      purpose: true,
    },
    // Mới nhất trước: nếu có nhiều ca còn mở thì ca vừa tạo mới là ca giáo
    // viên đang nói tới.
    orderBy: { createdAt: "desc" },
  });
  const existing =
    openCandidates.find(
      (s) =>
        isSessionOpen(s, now) &&
        // Đổi từ mở-ngay sang hẹn giờ (hoặc ngược lại) là ý định khác hẳn —
        // dùng lại ca cũ sẽ nuốt mất mốc giờ vừa nhập.
        (s.timingMode === "manual") === wantManual &&
        // Cùng lý do: buổi đang mở kiểu thi thật thì không được lặng lẽ biến
        // thành đợt thử nghiệm chỉ vì lần này bấm Mở từ trang thử nghiệm.
        // Khác mục đích ⇒ đó là buổi khác, mở buổi mới.
        (s.purpose ?? exam.purpose) === (opts.purpose ?? exam.purpose),
    ) ?? null;

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
    // Áp thiết lập vừa chọn lên ca đang mở. Im lặng bỏ qua thì giáo viên đổi
    // thời lượng rồi bấm Mở, thấy báo thành công, mà không có gì đổi cả.
    // Bài đang làm dở không bị ảnh hưởng: durationSec được chốt lúc bắt đầu.
    await db.examSession.update({
      where: { id: existing.id },
      data: {
        durationOverrideMin: opts.durationMin ?? null,
        revealAnswers: opts.revealAnswers ?? null,
        purpose: opts.purpose ?? null,
      },
    });
    return {
      code: existing.openCode,
      path: `/exam/${existing.openCode}`,
      sessionId: existing.id,
      published,
      reusedExistingCode: true,
    };
  }

  const roundId = await ensureDefaultRound(examId, db);
  const manual = wantManual;

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
          purpose: opts.purpose ?? null,
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
