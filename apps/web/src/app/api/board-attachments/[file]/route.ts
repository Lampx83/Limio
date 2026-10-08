import path from "node:path";
import { NextResponse } from "next/server";
import { boardAttachmentKeyFromFilename } from "@/lib/storage-keys";
import { isSafeFilename, resolveKey } from "@/lib/storage-serve";
import { THUMB_WIDTHS, getBoardThumb, type ThumbWidth } from "@/lib/boardImage";

export const runtime = "nodejs";

/**
 * Serve file GV upload trực tiếp làm đính kèm note (Padlet-style board).
 * Capability-based access: filename nhúng randomBytes(6) nên URL không đoán được.
 * `?w=480|960` trả thumbnail WebP (sinh sẵn lúc upload; ảnh cũ thì sinh lần đầu rồi lưu lại).
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
  req: Request,
  { params }: { params: { file: string } },
) {
  const file = params.file;
  if (!isSafeFilename(file)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  // ?w=480|960 → thumbnail WebP (chỉ nhận các cỡ cố định để không ai sinh vô hạn biến thể).
  // Không dùng được thumbnail (GIF, PDF, lỗi) thì rơi xuống phục vụ bản gốc.
  const w = Number(new URL(req.url).searchParams.get("w"));
  if (THUMB_WIDTHS.includes(w as ThumbWidth)) {
    const thumb = await getBoardThumb(file, w as ThumbWidth);
    if (thumb) {
      return new NextResponse(new Uint8Array(thumb), {
        headers: {
          "content-type": "image/webp",
          "content-length": String(thumb.length),
          "cache-control": "public, max-age=604800, immutable",
        },
      });
    }
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
