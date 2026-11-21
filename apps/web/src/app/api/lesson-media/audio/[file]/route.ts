import { NextResponse } from "next/server";
import { guardedLessonMedia } from "@/lib/lessonMediaGuard";
import { bufferResponse, getCachedAudio, loadAudioOnce } from "@/lib/audioBufferCache";
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
export const GET = guardedLessonMedia(async function GET(
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

  // Đã đọc cả file trước đó (xem audioBufferCache): trả thẳng từ bộ nhớ, không chạm kho — kể cả khi kho đang chậm.
  const cached = getCachedAudio(file);
  if (cached) return bufferResponse(cached, mime, req);

  const resolved = await resolveKey(key);
  if (!resolved) return new NextResponse("not_found", { status: 404 });

  if (resolved.absPath) {
    return streamWithRange(resolved.absPath, mime, req);
  }
  const streamed = await streamStorageWithRange(key, mime, req);
  if (streamed) return streamed;
  // Kho không phát từng đoạn được: đọc cả file MỘT lần (các yêu cầu cùng lúc dùng chung), nhớ lại, rồi trả đúng đoạn được xin.
  // Trước đây mỗi yêu cầu đọc lại cả file và trả 200 bỏ qua Range → tua / đệm tiếp đều chờ lại từ đầu.
  const buf = await loadAudioOnce(file, () => resolved.get());
  return bufferResponse(buf, mime, req);
});
