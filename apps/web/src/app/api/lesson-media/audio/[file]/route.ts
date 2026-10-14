import { NextResponse } from "next/server";
import { lessonAudioKeyFromFilename } from "@/lib/storage-keys";
import { audioMimeForFilename } from "@/lib/lessonAudio";
import {
  isSafeFilename,
  resolveKey,
  streamStorageWithRange,
  streamWithRange,
} from "@/lib/storage-serve";

export const runtime = "nodejs";

/**
 * LANG G1 — phát audio bài học. Hỗ trợ HTTP Range để tua được (không có 206 thì
 * kéo thanh tua là tải lại từ byte 0). Đọc công khai theo kiểu capability: tên
 * file mang hậu tố ngẫu nhiên, giống video. Đuôi ngoài danh sách (kể cả wav)
 * không được phát.
 */
export async function GET(
  req: Request,
  { params }: { params: { file: string } },
) {
  const file = params.file;
  if (!isSafeFilename(file)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const mime = audioMimeForFilename(file);
  if (!mime) return new NextResponse("not_found", { status: 404 });

  const key = lessonAudioKeyFromFilename(file);
  if (!key) return new NextResponse("not_found", { status: 404 });
  const resolved = await resolveKey(key);
  if (!resolved) return new NextResponse("not_found", { status: 404 });

  if (resolved.absPath) {
    return streamWithRange(resolved.absPath, mime, req);
  }
  const streamed = await streamStorageWithRange(key, mime, req);
  if (streamed) return streamed;
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
