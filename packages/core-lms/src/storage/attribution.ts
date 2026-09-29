import { prisma, type PrismaClient } from "@feedbackme/db";
import { resolveCourseOwner, type StoredFileKind } from "./ledger";

/**
 * Gán "dung lượng này tính cho ai" theo tham chiếu.
 *
 * Vì sao phải làm SAU khi upload: lúc upload video/ảnh bài giảng, bài học chưa
 * có (xem lesson-media/videos/route.ts — "uploads happen before the content row
 * is created"), nên chưa biết khoá nào. Chỉ khi bài học lưu URL của file thì mới
 * lần ra được khoá → chủ khoá.
 *
 * Chạy lại được nhiều lần (idempotent): chỉ xét dòng chưa được gán theo tham
 * chiếu. File chưa ai tham chiếu vẫn tính cho người upload.
 */

type Reference = { courseId: string | null; billedUserId: string | null; source: string };

// `position(x in y)` thay cho LIKE: tên file không cần escape `%`/`_`.
async function findReference(
  db: PrismaClient,
  kind: StoredFileKind,
  leaf: string,
): Promise<Reference | null> {
  switch (kind) {
    case "lesson_video":
    case "lesson_image":
    case "lesson_pdf":
    case "lesson_html":
    case "lesson_transcript": {
      // URL nằm trong payload của ContentItem, hoặc nhúng trong mô tả bài học.
      const rows = await db.$queryRaw<Array<{ courseId: string }>>`
        SELECT m."courseId" AS "courseId"
        FROM "Lesson" l
        JOIN "Module" m ON m.id = l."moduleId"
        WHERE position(${leaf} in coalesce(l.description, '')) > 0
           OR EXISTS (
             SELECT 1 FROM "ContentItem" ci
             WHERE ci."lessonId" = l.id AND position(${leaf} in ci.payload::text) > 0
           )
        LIMIT 1`;
      return rows[0]
        ? { courseId: rows[0].courseId, billedUserId: null, source: "content_item" }
        : null;
    }
    case "scorm_package":
    case "h5p_package": {
      // `leaf` của key `scorm/<id>` chính là packageId; bài học tham chiếu nó trong payload.
      const rows = await db.$queryRaw<Array<{ courseId: string }>>`
        SELECT m."courseId" AS "courseId"
        FROM "ContentItem" ci
        JOIN "Lesson" l ON l.id = ci."lessonId"
        JOIN "Module" m ON m.id = l."moduleId"
        WHERE ci.payload->>'packageId' = ${leaf}
        LIMIT 1`;
      return rows[0]
        ? { courseId: rows[0].courseId, billedUserId: null, source: "content_item" }
        : null;
    }
    case "submission": {
      const rows = await db.$queryRaw<Array<{ courseId: string }>>`
        SELECT m."courseId" AS "courseId"
        FROM "AssignmentSubmission" s
        JOIN "Assignment" a ON a.id = s."assignmentId"
        JOIN "Lesson" l ON l.id = a."lessonId"
        JOIN "Module" m ON m.id = l."moduleId"
        WHERE position(${leaf} in coalesce(s."attachmentUrl", '')) > 0
        LIMIT 1`;
      return rows[0]
        ? { courseId: rows[0].courseId, billedUserId: null, source: "submission" }
        : null;
    }
    case "exam_asset":
    case "oral_material": {
      const rows =
        kind === "exam_asset"
          ? await db.$queryRaw<Array<{ courseId: string | null; createdById: string | null }>>`
              SELECT e."courseId" AS "courseId", e."createdById" AS "createdById"
              FROM "ExamAsset" x JOIN "Exam" e ON e.id = x."examId"
              WHERE position(${leaf} in x."s3Key") > 0
              LIMIT 1`
          : await db.$queryRaw<Array<{ courseId: string | null; createdById: string | null }>>`
              SELECT e."courseId" AS "courseId", e."createdById" AS "createdById"
              FROM "OralExamMaterial" x JOIN "Exam" e ON e.id = x."examId"
              WHERE position(${leaf} in coalesce(x."s3Key", '')) > 0
              LIMIT 1`;
      const r = rows[0];
      if (!r) return null;
      // Đề độc lập (không gắn khoá): người tạo đề là chủ duy nhất.
      return { courseId: r.courseId, billedUserId: r.courseId ? null : r.createdById, source: kind };
    }
    default:
      return null;
  }
}

const REFERABLE: StoredFileKind[] = [
  "lesson_video",
  "lesson_image",
  "lesson_pdf",
  "lesson_html",
  "lesson_transcript",
  "submission",
  "exam_asset",
  "oral_material",
  "scorm_package",
  "h5p_package",
];

export interface AttributionResult {
  scanned: number;
  /** Đã gán theo tham chiếu (chủ khoá / người tạo đề). */
  attributed: number;
  /** Có tham chiếu tới khoá nhưng khoá không còn chủ → giữ nguyên người upload. */
  courseWithoutOwner: number;
  /** Chưa ai tham chiếu → giữ nguyên (người upload hoặc chưa gán). */
  unreferenced: number;
}

export async function attributeStoredFiles(
  opts: { limit?: number } = {},
  db: PrismaClient = prisma,
): Promise<AttributionResult> {
  const rows = await db.storedFile.findMany({
    where: {
      deletedAt: null,
      kind: { in: REFERABLE },
      // Đã gán theo tham chiếu thì thôi; "uploader"/null là gán tạm.
      OR: [{ attribution: null }, { attribution: "uploader" }],
    },
    select: { id: true, key: true, kind: true },
    take: opts.limit ?? 5000,
    orderBy: { createdAt: "asc" },
  });

  const result: AttributionResult = {
    scanned: rows.length,
    attributed: 0,
    courseWithoutOwner: 0,
    unreferenced: 0,
  };
  const ownerCache = new Map<string, string | null>();

  for (const row of rows) {
    const leaf = row.key.slice(row.key.lastIndexOf("/") + 1);
    const ref = await findReference(db, row.kind as StoredFileKind, leaf);
    if (!ref) {
      result.unreferenced++;
      continue;
    }
    let billed = ref.billedUserId;
    if (!billed && ref.courseId) {
      if (!ownerCache.has(ref.courseId)) {
        ownerCache.set(ref.courseId, await resolveCourseOwner(ref.courseId, db));
      }
      billed = ownerCache.get(ref.courseId) ?? null;
    }
    if (!billed) {
      result.courseWithoutOwner++;
      // Vẫn ghi lại khoá, để báo cáo theo khoá đúng.
      await db.storedFile.update({ where: { id: row.id }, data: { courseId: ref.courseId } });
      continue;
    }
    await db.storedFile.update({
      where: { id: row.id },
      data: {
        billedUserId: billed,
        courseId: ref.courseId,
        attribution: `reference:${ref.source}`,
        attributedAt: new Date(),
      },
    });
    result.attributed++;
  }
  return result;
}
