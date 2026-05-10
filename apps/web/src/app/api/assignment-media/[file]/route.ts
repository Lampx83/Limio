import path from "node:path";
import { NextResponse } from "next/server";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Serve an uploaded assignment-submission attachment back to the browser.
 *
 * Capability-based access: filename embeds a random suffix. Tighten later
 * with submission-aware authz once URLs flow through learn pages.
 */

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".zip": "application/zip",
  ".txt": "text/plain",
};

export async function GET(
  _req: Request,
  { params }: { params: { file: string } },
) {
  const file = params.file;
  if (!/^[a-zA-Z0-9._-]+$/.test(file) || file.includes("..")) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const storage = getStorage("assignment-submissions");
  if (!(await storage.exists(file))) {
    return new NextResponse("not_found", { status: 404 });
  }
  const buf = await storage.get(file);
  const ext = path.extname(file).toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": mime,
      "content-length": String(buf.length),
      "cache-control": "public, max-age=604800, immutable",
    },
  });
}
