import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { h5pPackageRoot } from "@feedbackme/core-lms";
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
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

export async function GET(
  _req: Request,
  { params }: { params: { id: string; path: string[] } },
) {
  const userId = await requireUserId();
  if (!userId) return new NextResponse("unauthorized", { status: 401 });
  const pkg = await prisma.h5pPackage.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!pkg) return new NextResponse("not_found", { status: 404 });

  const root = path.join(h5pPackageRoot(), params.id);
  const rel = (params.path ?? []).join("/");
  const abs = path.normalize(path.join(root, rel));
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    return new NextResponse("forbidden", { status: 403 });
  }
  let stat;
  try {
    stat = await fs.stat(abs);
  } catch {
    return new NextResponse("not_found", { status: 404 });
  }
  if (!stat.isFile()) return new NextResponse("not_found", { status: 404 });
  const buf = await fs.readFile(abs);
  const ext = path.extname(abs).toLowerCase();
  return new NextResponse(buf, {
    headers: {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "cache-control": "private, max-age=300",
    },
  });
}
