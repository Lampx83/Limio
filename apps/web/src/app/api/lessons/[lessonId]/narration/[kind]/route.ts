import { NextResponse } from "next/server";
import { NARRATION_KINDS, getPlayableNarrationFile, type NarrationKind } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { canListenToLesson } from "@/lib/narration/access";
import { streamStorageWithRange, streamWithRange } from "@/lib/storage-serve";
import { localAbsPath, storageFor } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Phát giọng đọc của một bài (docs/tieu-chi/nghe-giang-podcast.md, AC5): học viên CHỈ NGHE, không tải về.
 *  - Mỗi lượt kiểm quyền theo bài như trang bài học; khoá chưa xuất bản / bài ẩn / bài khoá thì không phát.
 *  - Chỉ phục vụ yêu cầu do phần tử âm thanh của trang gửi (`Sec-Fetch-Dest: audio`); mở thẳng đường dẫn trên thanh địa
 *    chỉ hoặc điều hướng để lưu tệp thì bị từ chối. Trình duyệt cũ không gửi tiêu đề này thì vẫn qua kiểm quyền ở trên.
 *  - Cho phép tua (Range) nhưng không để bộ nhớ đệm công cộng lưu tệp.
 */
export async function GET(req: Request, { params }: { params: { lessonId: string; kind: string } }) {
  if (!(NARRATION_KINDS as readonly string[]).includes(params.kind)) return new NextResponse("not_found", { status: 404 });
  const kind = params.kind as NarrationKind;

  const dest = req.headers.get("sec-fetch-dest");
  if (dest && dest !== "audio") return new NextResponse("forbidden", { status: 403 });

  const session = await auth();
  if (!(await canListenToLesson(session?.user?.id ?? null, params.lessonId))) return new NextResponse("forbidden", { status: 403 });

  const file = await getPlayableNarrationFile(params.lessonId, kind);
  if (!file) return new NextResponse("not_found", { status: 404 });

  const key = { layer: "private" as const, key: file.audioKey };
  const store = storageFor(key);
  if (!(await store.exists(key.key))) return new NextResponse("not_found", { status: 404 });

  const abs = localAbsPath(key);
  const res = abs
    ? await streamWithRange(abs, file.contentType, req)
    : ((await streamStorageWithRange(key, file.contentType, req)) ??
      new NextResponse(new Uint8Array(await store.get(key.key)), {
        headers: { "content-type": file.contentType, "accept-ranges": "bytes" },
      }));

  // Ghi đè tiêu đề của hàm phát dùng chung (vốn để cache công cộng 7 ngày cho tệp bài học).
  res.headers.set("cache-control", "private, no-store");
  res.headers.set("content-disposition", "inline");
  res.headers.set("x-content-type-options", "nosniff");
  return res;
}
