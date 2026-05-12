import { NextResponse } from "next/server";
import { lessonImageKeyFromFilename } from "@/lib/storage-keys";
import { isSafeFilename, resolveKey } from "@/lib/storage-serve";

export const runtime = "nodejs";

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export async function GET(
  _req: Request,
  { params }: { params: { file: string } },
) {
  const file = params.file;
  if (!isSafeFilename(file)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const resolved = await resolveKey(lessonImageKeyFromFilename(file));
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
