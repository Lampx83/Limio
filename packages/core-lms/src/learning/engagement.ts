import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "./events";
import { LearningError } from "./lessons";

/**
 * B11 — ghi lại người học thực sự ở lại bài bao lâu.
 *
 * Trước đây hệ thống chỉ biết một người **đã mở** bài (`lesson.viewed`, bắn
 * đúng một lần lúc trang tải xong). Nghĩa là em đọc kỹ hai mươi phút và em mở
 * bài rồi bỏ đó nhìn giống hệt nhau trong dữ liệu — và với một thực nghiệm về
 * phản hồi cá nhân hoá thì đó là biến quan trọng bị thiếu.
 *
 * Ba lựa chọn đáng nói:
 *
 * 1. **Máy khách cộng dồn, máy chủ nhận phần chênh.** Mỗi nhịp gửi lên số giây
 *    *thêm* kể từ nhịp trước, không phải tổng. Mất một nhịp thì mất đúng nhịp
 *    đó, chứ không làm sai lệch tổng — và không cần máy chủ nhớ trạng thái
 *    phiên.
 * 2. **Chỉ đếm lúc tab thực sự hiện.** Một tab mở suốt đêm không phải là tám
 *    tiếng học bài. Con số nào cũng đo được, nhưng con số sai thì tệ hơn không
 *    có, vì nó vẫn được đem đi phân tích.
 * 3. **Event chỉ phát khi khép một lượt ngồi đọc, không phát theo từng nhịp.**
 *    `LearningEvent` là append-only; một lớp 60 người đọc 30 phút mà mỗi nhịp
 *    một dòng thì sinh ra hàng nghìn dòng nói đúng những gì một dòng tổng kết
 *    đã nói.
 */

/** Chặn trên cho phần chênh mỗi nhịp — xem giải thích ở `MAX_DELTA_SEC`. */
export const MAX_DELTA_SEC = 120;

export const EngagementInput = z.object({
  /** Số giây tab hiện, tính từ lần gửi trước. */
  activeSecDelta: z.number().int().min(0).max(MAX_DELTA_SEC),
  /** Cuộn sâu nhất trong lượt này, 0–100. */
  scrollPct: z.number().int().min(0).max(100),
  /** Tỉ lệ video cao nhất trong lượt này, 0–100. */
  videoPct: z.number().int().min(0).max(100),
  /** Nhịp đầu tiên của một lượt ngồi đọc — dùng để đếm sessionCount. */
  sessionStart: z.boolean().default(false),
  /** Nhịp cuối — người học rời bài. Chỉ nhịp này mới phát event. */
  sessionEnd: z.boolean().default(false),
});

export interface EngagementResult {
  activeSec: number;
  maxScrollPct: number;
  maxVideoPct: number;
  sessionCount: number;
}

export async function recordLessonEngagement(
  userId: string,
  lessonId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<EngagementResult> {
  const parsed = EngagementInput.safeParse(rawInput);
  if (!parsed.success) {
    throw new LearningError("validation_failed", parsed.error.flatten());
  }
  const input = parsed.data;

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, module: { select: { courseId: true } } },
  });
  if (!lesson) throw new LearningError("lesson_not_found");
  const courseId = lesson.module.courseId;

  // Ghi danh là điều kiện: giảng viên xem thử bài của chính mình không nên
  // trộn vào số liệu về người học.
  const enrolled = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  if (!enrolled) throw new LearningError("not_enrolled");

  const existing = await db.lessonEngagement.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
    select: { activeSec: true, maxScrollPct: true, maxVideoPct: true, sessionCount: true },
  });

  const next = {
    activeSec: (existing?.activeSec ?? 0) + input.activeSecDelta,
    maxScrollPct: Math.max(existing?.maxScrollPct ?? 0, input.scrollPct),
    maxVideoPct: Math.max(existing?.maxVideoPct ?? 0, input.videoPct),
    sessionCount: (existing?.sessionCount ?? 0) + (input.sessionStart ? 1 : 0),
  };

  await db.lessonEngagement.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, courseId, ...next },
    update: next,
  });

  // Một lượt ngồi đọc khép lại — giờ mới có gì đáng kể vào lịch sử. Bỏ qua
  // lượt 0 giây: mở nhầm rồi đóng ngay không phải một lần học.
  if (input.sessionEnd && input.activeSecDelta > 0) {
    await emitEvent(
      userId,
      LearningEventType.LessonEngaged,
      {
        lessonId,
        activeSec: input.activeSecDelta,
        scrollPct: input.scrollPct,
        videoPct: input.videoPct,
        totalActiveSec: next.activeSec,
      },
      { courseId },
      db,
    );
  }

  return next;
}

export interface LessonEngagementRow {
  userId: string;
  lessonId: string;
  activeSec: number;
  maxScrollPct: number;
  maxVideoPct: number;
  sessionCount: number;
  lastSeenAt: Date;
}

/** Toàn bộ số liệu tương tác của một khoá — dùng cho bảng phân tích và export. */
export async function getCourseEngagement(
  courseId: string,
  db: PrismaClient = prisma,
): Promise<LessonEngagementRow[]> {
  return db.lessonEngagement.findMany({
    where: { courseId },
    select: {
      userId: true,
      lessonId: true,
      activeSec: true,
      maxScrollPct: true,
      maxVideoPct: true,
      sessionCount: true,
      lastSeenAt: true,
    },
    orderBy: [{ lessonId: "asc" }, { userId: "asc" }],
  });
}
