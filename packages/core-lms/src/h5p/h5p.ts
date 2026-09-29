import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import {
  assertDeclaredWithinLimits,
  DEFAULT_PACKAGE_LIMITS,
  extractEntries,
  PackageLimitError,
  type PackageLimits,
} from "../storage/packageFiles";
import { markStoredFileDeleted, PACKAGE_LAYER, recordStoredFile } from "../storage/ledger";

export class H5pError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "h5p_json_missing"
      | "h5p_json_invalid"
      | "package_too_large"
      | "package_unpacked_too_large"
      | "package_too_many_files"
      | "package_in_use"
      | "package_has_attempts"
      | "package_not_found"
      | "attempt_not_found"
      | "forbidden",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

const MAX_PACKAGE_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB

function packageRoot(): string {
  return (
    process.env.H5P_STORAGE_ROOT ??
    path.join(process.cwd(), "..", "..", "apps", "web", "uploads", "h5p")
  );
}

interface ParsedH5pJson {
  title: string;
  mainLibrary: string;
}

function parseH5pJson(text: string): ParsedH5pJson {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new H5pError("h5p_json_invalid", "json_parse_failed");
  }
  const title = typeof obj.title === "string" ? obj.title : "Untitled H5P content";
  const mainLibrary = typeof obj.mainLibrary === "string" ? obj.mainLibrary : "";
  if (!mainLibrary) {
    throw new H5pError("h5p_json_invalid", "missing_mainLibrary");
  }
  return { title, mainLibrary };
}

export async function uploadH5pPackage(
  uploaderId: string,
  fileBuffer: Buffer,
  originalName: string,
  db: PrismaClient = prisma,
  opts: { limits?: PackageLimits } = {},
) {
  const limits = opts.limits ?? DEFAULT_PACKAGE_LIMITS;
  if (fileBuffer.length > MAX_PACKAGE_SIZE_BYTES) {
    throw new H5pError("package_too_large");
  }
  const fileHash = createHash("sha256").update(fileBuffer).digest("hex");

  let zip: AdmZip;
  try {
    zip = new AdmZip(fileBuffer);
  } catch {
    throw new H5pError("validation_failed", "invalid_zip");
  }
  const entries = zip.getEntries();
  const h5pJsonEntry = entries.find(
    (e) => !e.isDirectory && /(^|\/)h5p\.json$/i.test(e.entryName),
  );
  if (!h5pJsonEntry) throw new H5pError("h5p_json_missing");
  const parsed = parseH5pJson(h5pJsonEntry.getData().toString("utf-8"));

  const manifestDir = path.posix.dirname(h5pJsonEntry.entryName);
  const stripPrefix = manifestDir === "." ? "" : manifestDir + "/";

  // Chặn zip "phình" TRƯỚC khi tạo dòng DB hay ghi gì ra đĩa.
  try {
    assertDeclaredWithinLimits(entries, limits);
  } catch (e) {
    if (e instanceof PackageLimitError) throw new H5pError(e.code, e.details);
    throw e;
  }

  const created = await db.h5pPackage.create({
    data: {
      fileHash,
      mainLibrary: parsed.mainLibrary,
      title: parsed.title,
      originalName,
      sizeBytes: fileBuffer.length,
      uploaderId,
    },
  });

  const targetDir = path.join(packageRoot(), created.id);
  let unpacked: { bytes: number; files: number };
  try {
    await fs.mkdir(targetDir, { recursive: true });
    unpacked = await extractEntries({ entries, stripPrefix, targetDir, limits });
  } catch (e) {
    // Ghi dở dang (vượt giới hạn, đầy đĩa…): không để lại dòng DB trỏ vào gói
    // thiếu file, cũng không để lại thư mục nửa vời chiếm đĩa.
    await fs.rm(targetDir, { recursive: true, force: true }).catch(() => undefined);
    await db.h5pPackage.delete({ where: { id: created.id } }).catch(() => undefined);
    if (e instanceof PackageLimitError) throw new H5pError(e.code, e.details);
    throw e;
  }

  // Sổ ghi dung lượng: 1 dòng cho cả gói, tính theo dung lượng SAU giải nén (số
  // thật chiếm đĩa, lớn hơn nhiều so với file zip). Lỗi sổ không làm hỏng upload.
  await recordStoredFile({
    layer: PACKAGE_LAYER,
    key: `h5p/${created.id}`,
    sizeBytes: unpacked.bytes,
    uploaderUserId: uploaderId,
  }).catch((e) => console.warn("[storage-ledger] ghi gói h5p thất bại:", (e as Error).message));

  return created;
}

export async function deleteH5pPackage(
  packageId: string,
  db: PrismaClient = prisma,
) {
  // Xoá gói kéo theo xoá toàn bộ lượt học (H5pAttempt có onDelete: Cascade) và để
  // bài học trỏ vào gói không còn — chỉ xoá khi không còn ai dùng.
  const [inUse, attempts] = await Promise.all([
    db.contentItem.count({
      where: { type: "h5p", payload: { path: ["packageId"], equals: packageId } },
    }),
    db.h5pAttempt.count({ where: { packageId } }),
  ]);
  if (inUse > 0) throw new H5pError("package_in_use", { contentItems: inUse });
  if (attempts > 0) throw new H5pError("package_has_attempts", { attempts });

  await db.h5pPackage.delete({ where: { id: packageId } });
  await fs.rm(path.join(packageRoot(), packageId), {
    recursive: true,
    force: true,
  });
  await markStoredFileDeleted(PACKAGE_LAYER, `h5p/${packageId}`, db).catch(() => undefined);
}

export async function listH5pPackages(db: PrismaClient = prisma) {
  return db.h5pPackage.findMany({
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      title: true,
      mainLibrary: true,
      originalName: true,
      sizeBytes: true,
      uploadedAt: true,
    },
  });
}

export async function getOrCreateH5pAttempt(
  userId: string,
  packageId: string,
  ctx: { courseId?: string | null; lessonId?: string | null } = {},
  db: PrismaClient = prisma,
) {
  const existing = await db.h5pAttempt.findUnique({
    where: { packageId_userId: { packageId, userId } },
  });
  if (existing) {
    // Backfill course/lesson context if a later launch resolves them.
    const patch: Prisma.H5pAttemptUpdateInput = {};
    if (ctx.courseId && !existing.courseId) patch.courseId = ctx.courseId;
    if (ctx.lessonId && !existing.lessonId) patch.lessonId = ctx.lessonId;
    if (Object.keys(patch).length > 0) {
      return db.h5pAttempt.update({ where: { id: existing.id }, data: patch });
    }
    return existing;
  }
  return db.h5pAttempt.create({
    data: {
      packageId,
      userId,
      courseId: ctx.courseId ?? null,
      lessonId: ctx.lessonId ?? null,
    },
  });
}

export interface XapiPatch {
  verb?: string;
  scoreRaw?: number | null;
  scoreMax?: number | null;
  success?: boolean | null;
  state?: Record<string, unknown> | null;
}

export async function recordH5pXapi(
  userId: string,
  attemptId: string,
  patch: XapiPatch,
  db: PrismaClient = prisma,
) {
  const a = await db.h5pAttempt.findUnique({ where: { id: attemptId } });
  if (!a) throw new H5pError("attempt_not_found");
  if (a.userId !== userId) throw new H5pError("forbidden");

  const data: Prisma.H5pAttemptUpdateInput = {};
  if (typeof patch.verb === "string") data.lastVerb = patch.verb;
  if (patch.scoreRaw !== undefined) data.scoreRaw = patch.scoreRaw;
  if (patch.scoreMax !== undefined) data.scoreMax = patch.scoreMax;
  if (patch.success !== undefined) data.success = patch.success;
  if (patch.state !== undefined) {
    data.state = patch.state === null ? Prisma.JsonNull : (patch.state as Prisma.InputJsonValue);
  }
  await db.h5pAttempt.update({ where: { id: attemptId }, data });
}

export { packageRoot as h5pPackageRoot };
