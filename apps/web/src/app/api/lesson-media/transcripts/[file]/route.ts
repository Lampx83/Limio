import { NextResponse } from "next/server";
import { transcriptContentType } from "@/lib/captions";
import { guardedLessonMedia } from "@/lib/lessonMediaGuard";
import { lessonTranscriptKeyFromFilename } from "@/lib/storage-keys";
import { isSafeFilename, resolveKey } from "@/lib/storage-serve";

export const runtime = "nodejs";

/**
 * `.vtt` ra `text/vtt` để `<track>` của `<video>` nhận làm phụ đề (nút CC của trình duyệt); `.srt` giữ
 * `text/plain` (trình duyệt không dựng được track từ SRT). File nhỏ (≤ 2 MB) và track luôn được tải nguyên
 * cả file nên không cần Range; tên file có đuôi ngẫu nhiên nên cache `immutable` an toàn.
 */
export const GET = guardedLessonMedia(async function GET(
  _req: Request,
  { params }: { params: { file: string } },
) {
  const file = params.file;
  if (!isSafeFilename(file)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const resolved = await resolveKey(lessonTranscriptKeyFromFilename(file));
  if (!resolved) return new NextResponse("not_found", { status: 404 });

  const buf = await resolved.get();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": transcriptContentType(file),
      "x-content-type-options": "nosniff",
      "content-length": String(buf.length),
      "cache-control": "public, max-age=604800, immutable",
    },
  });
});
