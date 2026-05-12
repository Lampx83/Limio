import path from "node:path";
import { NextResponse } from "next/server";
import { lessonVideoKeyFromFilename } from "@/lib/storage-keys";
import {
  isSafeFilename,
  resolveWithLegacy,
  streamWithRange,
} from "@/lib/storage-serve";

export const runtime = "nodejs";

/**
 * Stream an uploaded lesson video. Honors HTTP Range so the browser can
 * seek (essential — without 206 partial responses, scrubbing the video
 * triggers a full re-download from byte 0). Public read for now
 * (capability-based: filename embeds a random suffix).
 */

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
};

export async function GET(
  req: Request,
  { params }: { params: { file: string } },
) {
  const file = params.file;
  if (!isSafeFilename(file)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const resolved = await resolveWithLegacy(
    lessonVideoKeyFromFilename(file),
    "lesson-videos",
    file,
  );
  if (!resolved) return new NextResponse("not_found", { status: 404 });

  const ext = path.extname(file).toLowerCase();
  const mime = MIME[ext] ?? "application/octet-stream";

  // Local FS → stream with Range support (essential for video scrubbing).
  // S3 → buffer and return 200; switch to redirect-to-signed-URL when we
  // move public assets onto a CDN.
  if (resolved.absPath) {
    return streamWithRange(resolved.absPath, mime, req);
  }
  const buf = await resolved.get();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": mime,
      "content-length": String(buf.length),
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=604800, immutable",
    },
  });
}
