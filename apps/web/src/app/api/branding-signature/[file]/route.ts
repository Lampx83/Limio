import path from "node:path";
import { NextResponse } from "next/server";
import { platformSignatureKey } from "@/lib/storage-keys";
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
 * Public read của ảnh chữ ký nền tảng Limio — hiển thị trên chứng nhận và
 * trang xác thực công khai, nên không gate auth (giống /api/org-logos).
 * Filename mang suffix ngẫu nhiên nên vẫn là capability URL.
 */
export async function GET(_req: Request, { params }: { params: { file: string } }) {
  const file = params.file;
  if (!isSafeFilename(file)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const resolved = await resolveKey(platformSignatureKey(file));
  if (!resolved) return new NextResponse("not_found", { status: 404 });

  const buf = await resolved.get();
  const ext = path.extname(file).toLowerCase();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "content-length": String(buf.length),
      "cache-control": "public, max-age=604800, immutable",
    },
  });
}
