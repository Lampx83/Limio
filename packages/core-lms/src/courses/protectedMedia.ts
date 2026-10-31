/**
 * AC1 học liệu bản quyền (docs/tieu-chi/hoc-lieu-nha-xuat-ban-P0.md).
 *
 * Khoá bật `Course.protectedMedia` thì file học liệu mà bài của khoá tham chiếu chỉ phục vụ người có quyền
 * vào khoá, thay vì "ai có link đều tải được". URL trong DB chỉ mang tên file (`/api/lesson-media/<loại>/<tên>`),
 * không mang id khoá, nên route phục vụ cần bảng tra `ProtectedMediaFile` để biết file thuộc khoá nào.
 *
 * Bảng tra được giữ đúng bằng ba đường, vì nội dung bài được ghi từ rất nhiều nơi (soạn tay, nhập Word/Markdown,
 * AI, sao khoá) và móc vào từng nơi sẽ sót:
 *  1. bật / tắt cờ: quét cả khoá, đây là nguồn đúng duy nhất (thêm lẫn bớt);
 *  2. lưu nội dung bài ở các đường soạn chính: chỉ thêm (`registerLessonMedia`);
 *  3. dựng trang bài cho học viên: chỉ thêm — lưới an toàn cho đường nào ở (2) bị sót. Học viên chỉ có URL
 *     sau khi trang đã dựng, nên file luôn vào bảng trước khi ai ngoài người soạn nhìn thấy link.
 *
 * Bài `previewable` (xem thử miễn phí) cố ý không được bảo vệ: giảng viên đã chủ động mở cho người chưa ghi danh.
 */

import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";
import { logAudit } from "../auth/audit";
import { emitEvent } from "../learning/events";
import { isUserEnrolled } from "../learning/enroll";
import { CourseAuthzError, canGradeCourse, isCourseOwner } from "./authz";

const MEDIA_URL = /\/api\/lesson-media\/(?:images|videos|audio|pdfs|html|files|transcripts)\/([A-Za-z0-9._-]+)/g;

/** Mọi tên file học liệu được nhắc tới trong một giá trị JSON bất kỳ (payload khối, HTML văn bản, mô tả). */
export function extractLessonMediaFilenames(value: unknown): string[] {
  const found = new Set<string>();
  const visit = (v: unknown, depth: number) => {
    if (depth > 40) return;
    if (typeof v === "string") {
      for (const m of v.matchAll(MEDIA_URL)) {
        // Dấu chấm cuối thuộc câu văn, không thuộc tên file ("... xem /api/.../a.pdf.").
        const name = m[1]!.replace(/\.+$/, "");
        if (name) found.add(name);
      }
    } else if (Array.isArray(v)) {
      for (const x of v) visit(x, depth + 1);
    } else if (v && typeof v === "object") {
      for (const x of Object.values(v)) visit(x, depth + 1);
    }
  };
  visit(value, 0);
  return [...found];
}

/**
 * Bật / tắt cờ. Chỉ chủ khoá (role owner) và admin nền tảng — đồng giảng viên sửa được nội dung nhưng không
 * đổi được chính sách bảo vệ, cùng triết lý với việc chỉ admin chỉnh giá. Luôn quét lại cả khoá, kể cả khi cờ
 * không đổi, để người dùng sửa lệch bảng tra bấm lại là đúng.
 */
export async function setCourseProtectedMedia(
  userId: string,
  courseId: string,
  enabled: boolean,
  db: DbClient = prisma,
): Promise<{ enabled: boolean; files: number }> {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, protectedMedia: true } });
  if (!course) throw new CourseAuthzError("not_found");
  if (!(await isCourseOwner(userId, courseId, db))) throw new CourseAuthzError("forbidden");

  const changed = course.protectedMedia !== enabled;
  if (changed) await db.course.update({ where: { id: courseId }, data: { protectedMedia: enabled } });
  const files = await syncProtectedMediaForCourse(courseId, db);

  if (changed) {
    const type = enabled ? LearningEventType.CourseProtectedMediaEnabled : LearningEventType.CourseProtectedMediaDisabled;
    await logAudit({ action: type, actorUserId: userId, payload: { courseId, files } }, db);
    await emitEvent(userId, type, { courseId, files }, { courseId }, db);
  }
  return { enabled, files };
}

/**
 * Quét cả khoá và đưa bảng tra về đúng: thêm file mới, bỏ file không còn được bài nào (không phải bài xem thử)
 * tham chiếu. Khoá tắt cờ thì xoá hết. Trả số file đang được bảo vệ.
 */
export async function syncProtectedMediaForCourse(courseId: string, db: DbClient = prisma): Promise<number> {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { protectedMedia: true } });
  if (!course?.protectedMedia) {
    await db.protectedMediaFile.deleteMany({ where: { courseId } });
    return 0;
  }
  const lessons = await db.lesson.findMany({
    where: { module: { courseId }, previewable: false },
    select: { description: true, contentItems: { select: { payload: true } } },
  });
  const names = new Set<string>();
  for (const l of lessons) {
    for (const n of extractLessonMediaFilenames(l.description)) names.add(n);
    for (const c of l.contentItems) for (const n of extractLessonMediaFilenames(c.payload)) names.add(n);
  }
  const list = [...names];
  await db.protectedMediaFile.deleteMany({ where: { courseId, filename: { notIn: list } } });
  if (list.length > 0) {
    await db.protectedMediaFile.createMany({
      data: list.map((filename) => ({ filename, courseId })),
      skipDuplicates: true,
    });
  }
  return list.length;
}

/**
 * Thêm (không bớt) file mà một bài đang tham chiếu. Rẻ khi khoá không bật cờ: một truy vấn rồi thoát.
 * Không bao giờ ném lỗi ra ngoài — đây là việc phụ, hỏng thì bài vẫn phải lưu / hiện được.
 */
export async function registerLessonMedia(lessonId: string, db: DbClient = prisma): Promise<number> {
  try {
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      select: {
        previewable: true,
        description: true,
        module: { select: { courseId: true, course: { select: { protectedMedia: true } } } },
        contentItems: { select: { payload: true } },
      },
    });
    if (!lesson?.module.course.protectedMedia || lesson.previewable) return 0;
    const names = new Set<string>(extractLessonMediaFilenames(lesson.description));
    for (const c of lesson.contentItems) for (const n of extractLessonMediaFilenames(c.payload)) names.add(n);
    if (names.size === 0) return 0;
    const r = await db.protectedMediaFile.createMany({
      data: [...names].map((filename) => ({ filename, courseId: lesson.module.courseId })),
      skipDuplicates: true,
    });
    return r.count;
  } catch {
    return 0;
  }
}

/** Các khoá đang bảo vệ file này. Rỗng = file không thuộc khoá bản quyền nào (phục vụ công khai như trước). */
export async function findProtectingCourseIds(filename: string, db: DbClient = prisma): Promise<string[]> {
  const rows = await db.protectedMediaFile.findMany({
    where: { filename, course: { protectedMedia: true } },
    select: { courseId: true },
  });
  return rows.map((r) => r.courseId);
}

/**
 * Người này có được xem file thuộc các khoá bản quyền đó không. Được nếu với BẤT KỲ khoá nào trong đó họ là
 * người dạy (kể cả trợ giảng) hoặc admin, đang có ghi danh còn hiệu lực, hoặc khoá đã mở công khai.
 */
export async function canAccessProtectedMedia(
  userId: string | null,
  courseIds: string[],
  db: DbClient = prisma,
): Promise<boolean> {
  const publicOnes = await db.course.count({
    where: { id: { in: courseIds }, publicAccess: true, status: "published" },
  });
  if (publicOnes > 0) return true;
  if (!userId) return false;
  for (const courseId of courseIds) {
    if (await isUserEnrolled(userId, courseId, db as typeof prisma)) return true;
    if (await canGradeCourse(userId, courseId, db)) return true;
  }
  return false;
}
