import path from "node:path";
import { NextResponse } from "next/server";
import { boardAttachmentKeyFromFilename } from "@/lib/storage-keys";
import { isSafeFilename, resolveKey } from "@/lib/storage-serve";

export const runtime = "nodejs";

/**
 * Serve file GV upload trực tiếp làm đính kèm note (Padlet-style board).
 * Capability-based access: filename nhúng randomBytes(6) nên URL không đoán được.
 */

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

export async function GET(
  _req: Request,
  { params }: { params: { file: string } },
) {
  const file = params.file;
  if (!isSafeFilename(file)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const resolved = await resolveKey(boardAttachmentKeyFromFilename(file));
  if (!resolved) return new NextResponse("not_found", { status: 404 });

  const buf = await resolved.get();
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
