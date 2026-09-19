import { NextResponse } from "next/server";
import { liveSlideImageKeyFromFilename } from "@/lib/storage-keys";
import { isSafeFilename, resolveKey } from "@/lib/storage-serve";

export const runtime = "nodejs";

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

// GET — public (giống lesson-media/whiteboard-pages); ảnh chỉ thật sự được
// nhúng trong màn hình soạn/trình chiếu của giáo viên, nhưng không có gì
// nhạy cảm để phải auth-gate riêng.
export async function GET(_req: Request, { params }: { params: { file: string } }) {
  const file = params.file;
  if (!isSafeFilename(file)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const resolved = await resolveKey(liveSlideImageKeyFromFilename(file));
  if (!resolved) return new NextResponse("not_found", { status: 404 });

  const buf = await resolved.get();
  const ext = (file.split(".").pop() ?? "").toLowerCase();
  const contentType = CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": contentType,
      "content-length": String(buf.length),
      "cache-control": "public, max-age=604800, immutable",
    },
  });
}
