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
 *
 * `videoRanges` (thêm sau, cho báo cáo chi tiết hơn) đi theo triết lý khác hẳn
 * ba điểm trên: máy khách gửi **toàn bộ tập đoạn đã gộp của lượt hiện tại**
 * mỗi nhịp (không phải phần chênh), máy chủ hợp với những gì đã lưu rồi gộp
 * lại. Hợp đoạn là phép idempotent — gửi trùng hay gửi lại một nhịp đã mất
 * trước đó đều không sai lệch gì, khác hẳn `activeSecDelta` (mất một nhịp là
 * mất thật). Không dùng chung triết lý phần-chênh cho ranges vì tua đi tua
 * lại sinh nhiều đoạn nhỏ, cộng dồn kiểu chênh lệch sẽ nhân đôi phần chồng
 * lấn.
 */

/** Chặn trên cho phần chênh mỗi nhịp — xem giải thích ở `MAX_DELTA_SEC`. */
export const MAX_DELTA_SEC = 120;
/** Trần số đoạn gửi lên một nhịp — chống payload phình vì client lỗi/cố ý. */
const MAX_RANGES_PER_BEAT = 40;

const VideoRange = z.tuple([z.number().min(0), z.number().min(0)]);

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
  /** Các đoạn [start,end] giây đã xem thật trong lượt này, đã gộp phía client. */
  videoRanges: z.array(VideoRange).max(MAX_RANGES_PER_BEAT).optional(),
  /** Vị trí phát (giây) tại lần timeupdate gần nhất — "điểm dừng". */
  videoPositionSec: z.number().min(0).optional(),
});

export interface EngagementResult {
  activeSec: number;
  maxScrollPct: number;
  maxVideoPct: number;
  sessionCount: number;
}

/**
 * Gộp hai tập đoạn [start,end] thành một tập không chồng lấn, sắp theo start.
 * Chỉ gộp khi thật sự chồng lấn hoặc chạm nhau (start ≤ end đoạn trước) — độ
 * "liên tục" của việc phát video do phía client tự quyết khi dựng đoạn, hàm
 * này chỉ hợp các đoạn đã có, không đoán thêm.
 */
export function mergeVideoRanges(
  existing: Array<[number, number]>,
  incoming: Array<[number, number]>,
): Array<[number, number]> {
  const all = [...existing, ...incoming]
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s)
    .map(([s, e]) => [Math.max(0, s), e] as [number, number])
    .sort((a, b) => a[0] - b[0]);

  const merged: Array<[number, number]> = [];
  for (const [s, e] of all) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) {
      if (e > last[1]) last[1] = e;
    } else {
      merged.push([s, e]);
    }
  }
  return merged;
}

/** Tổng số giây thật sự được phủ bởi tập đoạn (đã gộp). */
export function videoRangesCoverageSec(ranges: Array<[number, number]>): number {
  return ranges.reduce((sum, [s, e]) => sum + (e - s), 0);
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
    select: {
      id: true,
      module: { select: { courseId: true } },
      contentItems: { where: { type: "video" }, select: { payload: true }, take: 1 },
    },
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
    select: {
      activeSec: true,
      maxScrollPct: true,
      maxVideoPct: true,
      sessionCount: true,
      videoRanges: true,
    },
  });

  const mergedRanges = input.videoRanges
    ? mergeVideoRanges(
        (existing?.videoRanges as Array<[number, number]> | null) ?? [],
        input.videoRanges,
      )
    : ((existing?.videoRanges as Array<[number, number]> | null) ?? undefined);

  const next = {
    activeSec: (existing?.activeSec ?? 0) + input.activeSecDelta,
    maxScrollPct: Math.max(existing?.maxScrollPct ?? 0, input.scrollPct),
    maxVideoPct: Math.max(existing?.maxVideoPct ?? 0, input.videoPct),
    sessionCount: (existing?.sessionCount ?? 0) + (input.sessionStart ? 1 : 0),
  };

  await db.lessonEngagement.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: {
      userId,
      lessonId,
      courseId,
      ...next,
      videoRanges: mergedRanges ?? undefined,
      lastVideoPositionSec: input.videoPositionSec,
    },
    update: {
      ...next,
      ...(mergedRanges !== undefined ? { videoRanges: mergedRanges } : {}),
      ...(input.videoPositionSec !== undefined
        ? { lastVideoPositionSec: input.videoPositionSec }
        : {}),
    },
  });

  // Một lượt ngồi đọc khép lại — giờ mới có gì đáng kể vào lịch sử. Bỏ qua
  // lượt 0 giây: mở nhầm rồi đóng ngay không phải một lần học.
  if (input.sessionEnd && input.activeSecDelta > 0) {
    const durationSec = (
      lesson.contentItems[0]?.payload as { durationSec?: number } | undefined
    )?.durationSec;
    const coverageSec = mergedRanges ? videoRangesCoverageSec(mergedRanges) : undefined;
    await emitEvent(
      userId,
      LearningEventType.LessonEngaged,
      {
        lessonId,
        activeSec: input.activeSecDelta,
        scrollPct: input.scrollPct,
        videoPct: input.videoPct,
        totalActiveSec: next.activeSec,
        ...(coverageSec !== undefined ? { videoCoverageSec: coverageSec } : {}),
        ...(coverageSec !== undefined && durationSec
          ? { videoCoveragePct: Math.round(Math.min(1, coverageSec / durationSec) * 100) }
          : {}),
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
  /** Đoạn video đã xem thật, đã gộp. Null nếu bài không có video hoặc chưa nhận range nào. */
  videoRanges: Array<[number, number]> | null;
  /** Vị trí phát gần nhất — điểm dừng. */
  lastVideoPositionSec: number | null;
}

/** Toàn bộ số liệu tương tác của một khoá — dùng cho bảng phân tích và export. */
export async function getCourseEngagement(
  courseId: string,
  db: PrismaClient = prisma,
): Promise<LessonEngagementRow[]> {
  const rows = await db.lessonEngagement.findMany({
    where: { courseId },
    select: {
      userId: true,
      lessonId: true,
      activeSec: true,
      maxScrollPct: true,
      maxVideoPct: true,
      sessionCount: true,
      lastSeenAt: true,
      videoRanges: true,
      lastVideoPositionSec: true,
    },
    orderBy: [{ lessonId: "asc" }, { userId: "asc" }],
  });
  return rows.map((r) => ({
    ...r,
    videoRanges: r.videoRanges as Array<[number, number]> | null,
  }));
}
