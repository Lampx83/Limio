import { prisma, type PrismaClient } from "@feedbackme/db";

/**
 * Bài nào có video — để mọi danh sách bài (mục lục khoá, catalog, thanh bài và ngăn kéo mục lục trong trang bài) cho học viên
 * thấy ngay, khỏi phải mở từng bài ra dò. Chỉ tính khối video học viên thực sự thấy (`isHidden = false`).
 */
export type LessonVideoInfo = {
  /** Tổng thời lượng (giây) các video của bài; null khi không video nào khai báo `durationSec`. */
  durationSec: number | null;
};

/** `durationSec` trong payload video; bỏ qua giá trị không phải số dương hữu hạn (payload do người dùng nhập, không tin). */
export function videoDurationOf(payload: unknown): number | null {
  if (payload === null || typeof payload !== "object") return null;
  const v = (payload as { durationSec?: unknown }).durationSec;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

/** Hàm thuần: gộp các khối video (đã lọc ẩn) thành bài → thông tin video. Bài không có khối nào thì không xuất hiện trong map. */
export function summarizeLessonVideos(
  rows: ReadonlyArray<{ lessonId: string; payload: unknown }>,
): Map<string, LessonVideoInfo> {
  const out = new Map<string, LessonVideoInfo>();
  for (const r of rows) {
    const d = videoDurationOf(r.payload);
    const prev = out.get(r.lessonId);
    out.set(r.lessonId, { durationSec: d === null ? (prev?.durationSec ?? null) : (prev?.durationSec ?? 0) + d });
  }
  return out;
}

/**
 * Các bài của khoá có video, bằng MỘT truy vấn nhẹ: chỉ lấy khối `type = video` chưa ẩn (không kéo payload của mọi khối).
 * Lọc theo `type: "video"` thay vì đọc `type` của từng khối, vì DB production có thể có loại khối mới hơn Prisma client đang chạy.
 */
export async function loadCourseLessonVideos(
  courseId: string,
  db: Pick<PrismaClient, "contentItem"> = prisma,
): Promise<Map<string, LessonVideoInfo>> {
  const rows = await db.contentItem.findMany({
    where: { type: "video", isHidden: false, lesson: { module: { courseId } } },
    select: { lessonId: true, payload: true },
  });
  return summarizeLessonVideos(rows);
}
