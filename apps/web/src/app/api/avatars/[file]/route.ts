import path from "node:path";
import { NextResponse } from "next/server";
import { avatarKeyFromFilename } from "@/lib/storage-keys";
import { isSafeFilename, resolveKey } from "@/lib/storage-serve";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

/**
 * Public read of an uploaded avatar. Avatars surface in leaderboards,
 * forum posts, and shared instructor pages — so we don't gate them
 * behind auth. The filename embeds a random suffix that's only
 * disclosed to the owning user (and anyone they share their avatar
 * with), giving us a "capability URL" without auth overhead on every
 * request.
 */
export async function GET(
  _req: Request,
  { params }: { params: { file: string } },
) {
  const file = params.file;
  if (!isSafeFilename(file)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const resolved = await resolveKey(avatarKeyFromFilename(file));
  if (!resolved) return new NextResponse("not_found", { status: 404 });

  const buf = await resolved.get();
  const ext = path.extname(file).toLowerCase();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "content-length": String(buf.length),
      // Filename includes a random suffix per upload, so we can cache aggressively.
      "cache-control": "public, max-age=604800, immutable",
    },
  });
}
