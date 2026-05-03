import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { prisma, type PrismaClient } from "@feedbackme/db";

export class ScormError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "manifest_missing"
      | "manifest_invalid"
      | "package_too_large"
      | "package_not_found"
      | "attempt_not_found"
      | "forbidden"
      | "unsupported_version",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

const MAX_PACKAGE_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB

/** Where unzipped SCORM packages live. Override per-env via env var if needed. */
function packageRoot(): string {
  return (
    process.env.SCORM_STORAGE_ROOT ??
    path.join(process.cwd(), "..", "..", "apps", "web", "uploads", "scorm")
  );
}

interface ParsedManifest {
  title: string;
  entryHref: string;
  version: string;
}

/**
 * Parse imsmanifest.xml minimally. We only need:
 *   - <organization><title>...</title>
 *   - <resource identifier="..." href="..."> (the launch URL)
 *   - <metadata><schemaversion>1.2</schemaversion> (version detection)
 *
 * We don't pull a real XML parser — SCORM manifests are small + have a fixed
 * shape. A regex-based extractor handles the 95% case; if a manifest breaks
 * us we throw `manifest_invalid` and the instructor re-exports.
 */
function parseManifest(xml: string): ParsedManifest {
  // Title: first <title> inside <organization>.
  const titleMatch = xml.match(
    /<organizations?[^>]*>[\s\S]*?<organization[^>]*>[\s\S]*?<title>([^<]+)<\/title>/i,
  );
  const title = titleMatch?.[1]?.trim() ?? "Untitled SCORM package";

  // Find the default organization id, then the first <item> identifierref.
  const defaultOrg = xml.match(/<organizations\s+default="([^"]+)"/i)?.[1];
  let firstItemRef: string | null = null;
  if (defaultOrg) {
    const orgBlockRe = new RegExp(
      `<organization\\s+identifier="${defaultOrg}"[^>]*>([\\s\\S]*?)</organization>`,
      "i",
    );
    const block = xml.match(orgBlockRe)?.[1] ?? "";
    firstItemRef = block.match(/<item[^>]*identifierref="([^"]+)"/i)?.[1] ?? null;
  }
  // Fallback: just first <item>.
  if (!firstItemRef) {
    firstItemRef = xml.match(/<item[^>]*identifierref="([^"]+)"/i)?.[1] ?? null;
  }
  // Resolve identifierref → resource.href
  let entryHref: string | null = null;
  if (firstItemRef) {
    const resRe = new RegExp(
      `<resource[^>]*identifier="${firstItemRef}"[^>]*href="([^"]+)"`,
      "i",
    );
    entryHref = xml.match(resRe)?.[1] ?? null;
  }
  // Last-ditch: first resource href in document.
  if (!entryHref) {
    entryHref = xml.match(/<resource[^>]*href="([^"]+)"/i)?.[1] ?? null;
  }
  if (!entryHref) {
    throw new ScormError("manifest_invalid", "no_entry_href_found");
  }

  // Version: <schemaversion>1.2</schemaversion> — be lenient. Supports both
  // SCORM 1.2 and SCORM 2004 (any edition). scorm-again handles both APIs.
  const v = xml.match(/<schemaversion>([^<]+)<\/schemaversion>/i)?.[1]?.trim();
  let version = "1.2";
  if (v) {
    if (/2004/.test(v)) version = "2004";
    else if (/1\.2/.test(v) || /^v?1\.2/i.test(v)) version = "1.2";
    else throw new ScormError("unsupported_version", `version=${v}`);
  }

  return { title, entryHref, version };
}

/**
 * Upload + unzip a SCORM 1.2 package.
 * - Validates ZIP, extracts to `apps/web/uploads/scorm/{packageId}/`
 * - Parses imsmanifest.xml for title + entry HTML
 * - Returns the persisted ScormPackage row
 */
export async function uploadScormPackage(
  uploaderId: string,
  fileBuffer: Buffer,
  originalName: string,
  db: PrismaClient = prisma,
) {
  if (fileBuffer.length > MAX_PACKAGE_SIZE_BYTES) {
    throw new ScormError("package_too_large");
  }
  const fileHash = createHash("sha256").update(fileBuffer).digest("hex");

  let zip: AdmZip;
  try {
    zip = new AdmZip(fileBuffer);
  } catch {
    throw new ScormError("validation_failed", "invalid_zip");
  }
  const entries = zip.getEntries();
  // Find imsmanifest.xml at root or within a single top-level folder.
  let manifestEntry = entries.find(
    (e) => !e.isDirectory && e.entryName.toLowerCase().endsWith("imsmanifest.xml"),
  );
  if (!manifestEntry) throw new ScormError("manifest_missing");
  const manifestXml = manifestEntry.getData().toString("utf-8");
  const parsed = parseManifest(manifestXml);

  // Compute strip prefix — manifest may live under a top folder.
  const manifestDir = path.posix.dirname(manifestEntry.entryName);
  const stripPrefix = manifestDir === "." ? "" : manifestDir + "/";

  const created = await db.scormPackage.create({
    data: {
      fileHash,
      version: parsed.version,
      title: parsed.title,
      entryHref: parsed.entryHref,
      originalName,
      sizeBytes: fileBuffer.length,
      uploaderId,
    },
  });

  const targetDir = path.join(packageRoot(), created.id);
  await fs.mkdir(targetDir, { recursive: true });
  for (const e of entries) {
    if (e.isDirectory) continue;
    const rel = e.entryName.startsWith(stripPrefix)
      ? e.entryName.slice(stripPrefix.length)
      : e.entryName;
    if (!rel || rel.includes("..")) continue; // path traversal guard
    const dest = path.join(targetDir, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, e.getData());
  }

  return created;
}

export async function deleteScormPackage(
  packageId: string,
  db: PrismaClient = prisma,
) {
  await db.scormPackage.delete({ where: { id: packageId } });
  const dir = path.join(packageRoot(), packageId);
  await fs.rm(dir, { recursive: true, force: true });
}

/** Open or resume an attempt. Idempotent on (package, user). */
export async function getOrCreateAttempt(
  userId: string,
  packageId: string,
  ctx: { courseId?: string | null; lessonId?: string | null } = {},
  db: PrismaClient = prisma,
) {
  const existing = await db.scormAttempt.findUnique({
    where: { packageId_userId: { packageId, userId } },
  });
  if (existing) return existing;
  return db.scormAttempt.create({
    data: {
      packageId,
      userId,
      courseId: ctx.courseId ?? null,
      lessonId: ctx.lessonId ?? null,
    },
  });
}

/**
 * Persist a CMI commit from the client. We only accept whitelisted fields to
 * avoid arbitrary writes. Called on LMSCommit + LMSFinish.
 */
export interface CmiCommit {
  lessonStatus?: string;
  completionStatus?: string;
  scoreRaw?: number | null;
  scoreMin?: number | null;
  scoreMax?: number | null;
  suspendData?: string | null;
  location?: string | null;
  totalTime?: string | null;
  finished?: boolean;
}

const ALLOWED_STATUSES = new Set([
  "passed",
  "completed",
  "failed",
  "incomplete",
  "browsed",
  "not attempted",
]);

export async function commitAttempt(
  userId: string,
  attemptId: string,
  patch: CmiCommit,
  db: PrismaClient = prisma,
) {
  const a = await db.scormAttempt.findUnique({ where: { id: attemptId } });
  if (!a) throw new ScormError("attempt_not_found");
  if (a.userId !== userId) throw new ScormError("forbidden");

  const data: Record<string, unknown> = { lastCommitAt: new Date() };
  if (patch.lessonStatus && ALLOWED_STATUSES.has(patch.lessonStatus)) {
    data.lessonStatus = patch.lessonStatus;
  }
  if (typeof patch.completionStatus === "string") {
    data.completionStatus = patch.completionStatus;
  }
  if (patch.scoreRaw !== undefined) data.scoreRaw = patch.scoreRaw;
  if (patch.scoreMin !== undefined) data.scoreMin = patch.scoreMin;
  if (patch.scoreMax !== undefined) data.scoreMax = patch.scoreMax;
  if (patch.suspendData !== undefined) {
    if (typeof patch.suspendData === "string" && patch.suspendData.length > 65536) {
      throw new ScormError("validation_failed", "suspend_data_too_large");
    }
    data.suspendData = patch.suspendData;
  }
  if (patch.location !== undefined) {
    if (typeof patch.location === "string" && patch.location.length > 255) {
      throw new ScormError("validation_failed", "location_too_long");
    }
    data.location = patch.location;
  }
  if (typeof patch.totalTime === "string") data.totalTime = patch.totalTime;
  if (patch.finished === true) data.finished = true;

  await db.scormAttempt.update({ where: { id: attemptId }, data });
}

export async function listScormPackages(db: PrismaClient = prisma) {
  return db.scormPackage.findMany({
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      title: true,
      version: true,
      entryHref: true,
      originalName: true,
      sizeBytes: true,
      uploadedAt: true,
    },
  });
}

export { packageRoot };
