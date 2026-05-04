import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { packageRoot } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

export async function GET(
  _req: Request,
  { params }: { params: { id: string; path: string[] } },
) {
  // Require auth — but allow any signed-in user (SCORM content within a
  // package isn't course-scoped here). For per-course gating, callers should
  // wrap this with their own check.
  const userId = await requireUserId();
  if (!userId) return new NextResponse("unauthorized", { status: 401 });

  const pkg = await prisma.scormPackage.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!pkg) {
    console.error(`[SCORM] Package not found: ${params.id}`);
    return new NextResponse("package_not_found", { status: 404 });
  }

  const root = path.join(packageRoot(), params.id);
  const rel = (params.path ?? []).join("/");
  const abs = path.normalize(path.join(root, rel));

  // Path traversal guard.
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    console.error(`[SCORM] Path traversal attempt: ${abs} vs root ${root}`);
    return new NextResponse("forbidden", { status: 403 });
  }

  let stat;
  try {
    stat = await fs.stat(abs);
  } catch (e) {
    console.error(`[SCORM] File not found: ${abs}`, e);
    return new NextResponse(`file_not_found:${rel}`, { status: 404 });
  }
  if (!stat.isFile()) {
    console.error(`[SCORM] Not a file: ${abs}`);
    return new NextResponse("not_a_file", { status: 404 });
  }

  const buf = await fs.readFile(abs);
  const ext = path.extname(abs).toLowerCase();
  return new NextResponse(buf, {
    headers: {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "cache-control": "private, max-age=300",
    },
  });
}
