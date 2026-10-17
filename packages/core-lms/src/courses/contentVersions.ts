import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";
import { assertCanEditCourse, CourseAuthzError } from "./authz";

/**
 * Phiên bản khối Văn bản để hoàn tác (tiêu chí S3) — cùng cách làm với phiên
 * bản slide Limio-Live. Mỗi lần payload sắp bị ghi đè, chụp lại TRẠNG THÁI CŨ:
 * - before_edit: trước khi sửa tay — các lần lưu trong 5 phút gộp làm một
 *   (bản chụp là trạng thái trước cả đợt sửa), nên lưu nhiều lần không sinh hàng trăm bản;
 * - before_ai: trước khi lưu một chỉnh sửa có dùng "Nhờ AI";
 * - before_restore: trước khi khôi phục (để khôi phục cũng hoàn tác được);
 * - before_convert: trước khi chuyển bài AI định dạng kiểu cũ sang dạng mới;
 * - before_regenerate: trước khi "Làm lại từ dàn ý" thay nội dung;
 * - generated: bài AI viết lúc Áp dụng. Luôn được giữ, không bị dọn.
 * Chỉ giữ MAX_OTHER_VERSIONS bản gần nhất ngoài các bản "generated".
 */

export const CONTENT_VERSION_SOURCES = [
  "generated",
  "before_edit",
  "before_ai",
  "before_restore",
  "before_convert",
  "before_regenerate",
] as const;
export type ContentVersionSource = (typeof CONTENT_VERSION_SOURCES)[number];

export const CONTENT_VERSION_COALESCE_MS = 5 * 60 * 1000;
export const MAX_OTHER_CONTENT_VERSIONS = 30;

/** Chỉ cần bảng phiên bản — dùng được cả trong transaction lẫn client thường. */
export type ContentVersionDb = Pick<PrismaClient, "contentItemVersion">;

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

/**
 * Chụp một phiên bản. Trả true nếu có ghi mới. Bỏ qua khi nội dung giống hệt
 * phiên bản mới nhất, hoặc (before_edit) khi bản mới nhất cũng là before_edit
 * vừa tạo trong cửa sổ gộp.
 */
export async function recordContentVersion(
  db: ContentVersionDb,
  item: { id: string; payload: unknown },
  source: ContentVersionSource,
  createdById: string | null = null,
  now: Date = new Date(),
): Promise<boolean> {
  const latest = await db.contentItemVersion.findFirst({
    where: { contentItemId: item.id },
    orderBy: { createdAt: "desc" },
    select: { source: true, payload: true, createdAt: true },
  });
  if (latest && source !== "generated" && stable(latest.payload) === stable(item.payload)) return false;
  if (
    source === "before_edit" &&
    latest?.source === "before_edit" &&
    now.getTime() - latest.createdAt.getTime() < CONTENT_VERSION_COALESCE_MS
  ) {
    return false;
  }
  await db.contentItemVersion.create({
    data: {
      contentItemId: item.id,
      source,
      payload: (item.payload ?? {}) as Prisma.InputJsonValue,
      createdById,
      createdAt: now,
    },
  });
  const extra = await db.contentItemVersion.findMany({
    where: { contentItemId: item.id, source: { not: "generated" } },
    orderBy: { createdAt: "desc" },
    skip: MAX_OTHER_CONTENT_VERSIONS,
    select: { id: true },
  });
  if (extra.length) await db.contentItemVersion.deleteMany({ where: { id: { in: extra.map((x) => x.id) } } });
  return true;
}

async function loadItem(userId: string, contentItemId: string, db: PrismaClient) {
  const item = await db.contentItem.findUnique({
    where: { id: contentItemId },
    select: { id: true, type: true, payload: true, lessonId: true, lesson: { select: { module: { select: { courseId: true } } } } },
  });
  if (!item) throw new CourseAuthzError("not_found");
  await assertCanEditCourse(userId, item.lesson.module.courseId, db);
  return item;
}

export interface ContentVersionView {
  id: string;
  source: ContentVersionSource;
  payload: unknown;
  createdAt: Date;
}

/** Các phiên bản của khối, mới nhất trước (chỉ người sửa được khoá). */
export async function listContentVersions(
  userId: string,
  contentItemId: string,
  db: PrismaClient = prisma,
): Promise<ContentVersionView[]> {
  await loadItem(userId, contentItemId, db);
  const rows = await db.contentItemVersion.findMany({
    where: { contentItemId },
    orderBy: { createdAt: "desc" },
    select: { id: true, source: true, payload: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, source: r.source as ContentVersionSource }));
}

/**
 * Khôi phục khối về một phiên bản. Trạng thái hiện tại được chụp trước
 * (before_restore) nên khôi phục cũng hoàn tác được. Ghi sự kiện S7.
 */
export async function restoreContentVersion(
  userId: string,
  contentItemId: string,
  versionId: string,
  db: PrismaClient = prisma,
): Promise<{ payload: unknown }> {
  const item = await loadItem(userId, contentItemId, db);
  const version = await db.contentItemVersion.findFirst({
    where: { id: versionId, contentItemId },
    select: { id: true, source: true, payload: true },
  });
  if (!version) throw new CourseAuthzError("not_found");
  await db.$transaction(async (tx) => {
    await recordContentVersion(tx, { id: item.id, payload: item.payload }, "before_restore", userId);
    await tx.contentItem.update({
      where: { id: contentItemId },
      data: { payload: version.payload as Prisma.InputJsonValue },
    });
    await emitEvent(
      userId,
      LearningEventType.LessonContentRestored,
      { contentItemId, versionId, versionSource: version.source },
      { courseId: item.lesson.module.courseId },
      tx,
    );
  });
  return { payload: version.payload };
}
