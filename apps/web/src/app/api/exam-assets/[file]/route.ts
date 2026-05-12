import path from "node:path";
import { NextResponse } from "next/server";
import { examAssetKeyFromFilename } from "@/lib/storage-keys";
import { isSafeFilename, resolveKey } from "@/lib/storage-serve";

export const runtime = "nodejs";

/**
 * Serve uploaded exam image/audio assets. Capability-based access: filename
 * embeds randomBytes(8) so URLs are unguessable. Auth tightening (per-exam)
 * deferred to a later phase when learner-facing exam UI lands.
 */

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".weba": "audio/webm",
  ".m4a": "audio/mp4",
};

export async function GET(
  _req: Request,
  { params }: { params: { file: string } },
) {
  const file = params.file;
  if (!isSafeFilename(file)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const resolved = await resolveKey(examAssetKeyFromFilename(file));
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
