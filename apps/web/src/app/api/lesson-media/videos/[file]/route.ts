import path from "node:path";
import { NextResponse } from "next/server";
import { lessonVideoKeyFromFilename } from "@/lib/storage-keys";
import {
  isSafeFilename,
  resolveKey,
  streamStorageWithRange,
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

  const key = lessonVideoKeyFromFilename(file);
  const resolved = await resolveKey(key);
  if (!resolved) return new NextResponse("not_found", { status: 404 });

  const ext = path.extname(file).toLowerCase();
  const mime = MIME[ext] ?? "application/octet-stream";

  // Local FS → stream with Range support (essential for video scrubbing).
  if (resolved.absPath) {
    return streamWithRange(resolved.absPath, mime, req);
  }
  // S3 → stream từng đoạn (Range) thẳng từ NAS, không nạp cả video vào RAM.
  const streamed = await streamStorageWithRange(key!, mime, req);
  if (streamed) return streamed;
  // Còn lại (file chỉ ở fallback local): buffer.
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
