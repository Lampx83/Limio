import { NextResponse } from "next/server";
import { getPlayableLecturerVideo } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { canListenToLesson } from "@/lib/narration/access";
import { lecturerVideoEnabled } from "@/lib/narration/lecturerVideoFlag";
import { streamStorageWithRange, streamWithRange } from "@/lib/storage-serve";
import { localAbsPath, storageFor } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Phát video giảng viên nói của lời giảng (docs/tieu-chi/trinh-chieu-giang-vien.md, AC7): `?r=sm` bản 256 px cho điện thoại, mặc định
 * bản 512 px. Quy tắc như tuyến phát giọng:
 *  - kiểm quyền theo bài như trang bài học (`canListenToLesson`);
 *  - chỉ phục vụ yêu cầu do phần tử `<video>` của trang gửi (`Sec-Fetch-Dest: video`);
 *  - cho tua (Range), không cho bộ nhớ đệm công cộng lưu; 404 khi chưa có video, video đã cũ so với giọng, hoặc cờ tắt
 *    (trình phát khi đó dùng ảnh tĩnh).
 */
export async function GET(req: Request, { params }: { params: { lessonId: string } }) {
  const dest = req.headers.get("sec-fetch-dest");
  if (dest && dest !== "video") return new NextResponse("forbidden", { status: 403 });

  const session = await auth();
  if (!(await canListenToLesson(session?.user?.id ?? null, params.lessonId))) return new NextResponse("forbidden", { status: 403 });

  const rendition = new URL(req.url).searchParams.get("r") === "sm" ? "sm" : "lg";
  const file = await getPlayableLecturerVideo(params.lessonId, rendition, undefined, { lecturerVideo: lecturerVideoEnabled() });
  if (!file) return new NextResponse("not_found", { status: 404 });

  const key = { layer: "private" as const, key: file.key };
  const store = storageFor(key);
  if (!(await store.exists(key.key))) return new NextResponse("not_found", { status: 404 });

  const abs = localAbsPath(key);
  const res = abs
    ? await streamWithRange(abs, file.contentType, req)
    : ((await streamStorageWithRange(key, file.contentType, req)) ??
      new NextResponse(new Uint8Array(await store.get(key.key)), {
        headers: { "content-type": file.contentType, "accept-ranges": "bytes" },
      }));

  res.headers.set("cache-control", "private, no-store");
  res.headers.set("content-disposition", "inline");
  res.headers.set("x-content-type-options", "nosniff");
  return res;
}
