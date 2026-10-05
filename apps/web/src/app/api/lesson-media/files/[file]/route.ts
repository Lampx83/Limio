import { NextResponse } from "next/server";
import { lessonFileKeyFromFilename } from "@/lib/storage-keys";
import { lessonFileMimeForFilename } from "@/lib/lessonFile";
import { isSafeFilename, resolveKey } from "@/lib/storage-serve";

export const runtime = "nodejs";

/**
 * Tải file đính kèm của bài học. Đọc công khai kiểu capability (tên file có
 * hậu tố ngẫu nhiên), giống PDF/audio.
 *
 * Luôn `attachment` + `nosniff`: file do GV tải lên là nội dung không tin cậy,
 * không được để trình duyệt mở/đoán kiểu rồi chạy trên origin của mình. Tên
 * hiển thị khi lưu do thuộc tính `download` ở LessonContent đặt (header không
 * mang `filename=` nên `download` được ưu tiên).
 */
export async function GET(_req: Request, { params }: { params: { file: string } }) {
  const file = params.file;
  if (!isSafeFilename(file)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const mime = lessonFileMimeForFilename(file);
  if (!mime) return new NextResponse("not_found", { status: 404 });

  const resolved = await resolveKey(lessonFileKeyFromFilename(file));
  if (!resolved) return new NextResponse("not_found", { status: 404 });

  const buf = await resolved.get();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": mime,
      "content-length": String(buf.length),
      "content-disposition": "attachment",
      "x-content-type-options": "nosniff",
      "cache-control": "public, max-age=604800, immutable",
    },
  });
}
