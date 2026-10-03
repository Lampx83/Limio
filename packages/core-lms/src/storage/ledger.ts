import { prisma, type PrismaClient } from "@feedbackme/db";

/**
 * Sổ ghi dung lượng (P0 — chỉ đo, chưa chặn).
 *
 * Mỗi file ghi vào kho lưu trữ có 1 dòng `StoredFile`: nó là gì, nặng bao
 * nhiêu, ai upload, và dung lượng đó TÍNH CHO AI.
 *
 * Quy tắc tính (đã chốt với chủ sản phẩm):
 * - Bài nộp, tài liệu bài giảng… của một khoá tính cho CHỦ KHOÁ, kể cả khi
 *   người upload là giảng viên đồng giảng hay trợ giảng.
 * - Mỗi giảng viên một phần riêng — không gộp theo tổ chức.
 * - Chưa tìm được khoá nào tham chiếu file thì tạm tính cho người upload.
 */

export type StoredFileKind =
  | "avatar"
  | "org_branding"
  | "platform_branding"
  | "lesson_video"
  | "lesson_audio"
  | "lesson_image"
  | "lesson_pdf"
  | "lesson_html"
  | "lesson_transcript"
  | "exam_asset"
  | "submission"
  | "proctor_snapshot"
  | "oral_material"
  | "whiteboard_page"
  | "board_attachment"
  | "live_slide"
  | "live_resource"
  | "scorm_package"
  | "h5p_package"
  | "tmp"
  | "other";

// Thứ tự quan trọng: "lesson-media/videos/" phải đứng trước mọi tiền tố ngắn hơn
// có thể trùng đầu. Giữ khớp với các hàm *Key trong apps/web/src/lib/storage-keys.ts.
const KIND_PREFIXES: ReadonlyArray<readonly [string, StoredFileKind]> = [
  ["avatars/", "avatar"],
  ["org-logos/", "org_branding"],
  ["org-signatures/", "org_branding"],
  ["branding/", "platform_branding"],
  ["lesson-media/videos/", "lesson_video"],
  ["lesson-media/audio/", "lesson_audio"],
  ["lesson-media/images/", "lesson_image"],
  ["lesson-media/pdfs/", "lesson_pdf"],
  ["lesson-media/html/", "lesson_html"],
  ["lesson-media/transcripts/", "lesson_transcript"],
  ["exam-assets/", "exam_asset"],
  ["submissions/", "submission"],
  ["proctor-snapshots/", "proctor_snapshot"],
  ["oral-exam-materials/", "oral_material"],
  ["whiteboard-pages/", "whiteboard_page"],
  ["board-attachments/", "board_attachment"],
  ["limio-live-slides/", "live_slide"],
  ["limio-live-resources/", "live_resource"],
];

/** "layer" giả cho gói SCORM/H5P — không phải layer của adapter lưu trữ. */
export const PACKAGE_LAYER = "package";

export function classifyStorageKey(layer: string, key: string): StoredFileKind {
  if (layer === "tmp") return "tmp";
  // Gói SCORM/H5P không đi qua adapter lưu trữ (ghi thẳng ra thư mục giải nén):
  // 1 dòng sổ cho cả gói, key = `scorm/<packageId>` hoặc `h5p/<packageId>`.
  if (layer === PACKAGE_LAYER) {
    if (key.startsWith("scorm/")) return "scorm_package";
    if (key.startsWith("h5p/")) return "h5p_package";
    return "other";
  }
  for (const [prefix, kind] of KIND_PREFIXES) {
    if (key.startsWith(prefix)) return kind;
  }
  return "other";
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
// Tên file các route upload đặt: `<userId>-<unixMs>-<hex>.<ext>`.
const FILENAME_UPLOADER = new RegExp(`^(${UUID})-\\d{10,}-[A-Za-z0-9]+\\.[A-Za-z0-9]+$`, "i");
const AVATAR_DIR = new RegExp(`^avatars/(${UUID})/`, "i");

/** Người bấm upload, suy từ key. null = không suy được (không đoán bừa). */
export function uploaderFromStorageKey(key: string): string | null {
  const avatar = AVATAR_DIR.exec(key);
  if (avatar) return avatar[1]!.toLowerCase();
  const leaf = key.slice(key.lastIndexOf("/") + 1);
  const m = FILENAME_UPLOADER.exec(leaf);
  return m ? m[1]!.toLowerCase() : null;
}

export interface RecordStoredFileInput {
  layer: string;
  key: string;
  sizeBytes: number;
  contentType?: string | null;
  /** Người upload đã biết chắc (vd gói SCORM có uploaderId); mặc định suy từ tên file. */
  uploaderUserId?: string | null;
}

/**
 * Ghi (hoặc cập nhật) 1 file vào sổ. Ghi đè cùng key thì cập nhật dung lượng và
 * hồi sinh nếu trước đó bị đánh dấu xoá; KHÔNG đụng vào cách gán chủ đã có.
 */
export async function recordStoredFile(
  input: RecordStoredFileInput,
  db: PrismaClient = prisma,
): Promise<void> {
  const kind = classifyStorageKey(input.layer, input.key);
  const uploader = input.uploaderUserId ?? uploaderFromStorageKey(input.key);
  await db.storedFile.upsert({
    where: { layer_key: { layer: input.layer, key: input.key } },
    create: {
      layer: input.layer,
      key: input.key,
      sizeBytes: BigInt(Math.max(0, Math.trunc(input.sizeBytes))),
      contentType: input.contentType ?? null,
      kind,
      uploaderUserId: uploader,
      // Tạm tính cho người upload; bước gán chủ (attributeStoredFiles) sẽ đổi
      // sang chủ khoá khi tìm được khoá tham chiếu file này.
      billedUserId: uploader,
      attribution: uploader ? "uploader" : null,
      attributedAt: uploader ? new Date() : null,
    },
    update: {
      sizeBytes: BigInt(Math.max(0, Math.trunc(input.sizeBytes))),
      contentType: input.contentType ?? undefined,
      deletedAt: null,
    },
  });
}

export async function markStoredFileDeleted(
  layer: string,
  key: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await db.storedFile.updateMany({
    where: { layer, key, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}

/** Chủ khoá = giảng viên có vai trò "owner" của khoá; null nếu khoá không còn chủ. */
export async function resolveCourseOwner(
  courseId: string,
  db: PrismaClient = prisma,
): Promise<string | null> {
  const owner = await db.courseInstructor.findFirst({
    where: { courseId, role: "owner" },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  return owner?.userId ?? null;
}

/** Tổng dung lượng đang tính cho một người (byte). Nền cho hạn mức ở P1. */
export async function getUserStorageUsageBytes(
  userId: string,
  db: PrismaClient = prisma,
): Promise<number> {
  const agg = await db.storedFile.aggregate({
    where: { billedUserId: userId, deletedAt: null },
    _sum: { sizeBytes: true },
  });
  return Number(agg._sum.sizeBytes ?? 0n);
}
