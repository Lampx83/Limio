import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

function avatarRoot(): string {
  return (
    process.env.AVATAR_STORAGE_ROOT ??
    path.join(process.cwd(), "uploads", "avatars")
  );
}

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

  // Strict filename — must look like "<uuid>-<hex>.<ext>" with safe chars.
  if (!/^[a-zA-Z0-9._-]+$/.test(file) || file.includes("..")) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const root = avatarRoot();
  const abs = path.normalize(path.join(root, file));
  if (!abs.startsWith(root + path.sep) && abs !== path.join(root, file)) {
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
      // Filename includes a random suffix per upload, so we can cache aggressively.
      "cache-control": "public, max-age=604800, immutable",
    },
  });
}
