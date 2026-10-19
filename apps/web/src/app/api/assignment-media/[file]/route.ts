import path from "node:path";
import { NextResponse } from "next/server";
import { submissionKeyFromFilename } from "@/lib/storage-keys";
import {
  isSafeFilename,
  resolveKey,
  streamStorageWithRange,
  streamWithRange,
} from "@/lib/storage-serve";

export const runtime = "nodejs";

/**
 * Serve an uploaded assignment-submission attachment back to the browser.
 *
 * Streams with HTTP Range support so instructors can scrub through video /
 * audio submissions and the server never has to buffer the full 200 MB blob
 * into memory.
 *
 * Capability-based access for now (filename embeds a random suffix). Tighten
 * later with submission-aware authz once URLs flow through learn pages — the
 * underlying file already lives in the `private` storage layer in preparation.
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
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".json": "application/json",
  ".zip": "application/zip",
  ".txt": "text/plain",
};

export async function GET(
  req: Request,
  { params }: { params: { file: string } },
) {
  const file = params.file;
  if (!isSafeFilename(file)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const key = submissionKeyFromFilename(file);
  const resolved = await resolveKey(key);
  if (!resolved) return new NextResponse("not_found", { status: 404 });

  const ext = path.extname(file).toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";

  // Local FS → stream with Range. S3 → stream từng đoạn (Range) để trình xem
  // PDF trong iframe của màn hình chấm mở được ngay, không đợi tải cả file.
  if (resolved.absPath) {
    return streamWithRange(resolved.absPath, mime, req);
  }
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
