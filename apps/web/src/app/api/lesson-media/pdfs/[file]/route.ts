import { NextResponse } from "next/server";
import { lessonPdfKeyFromFilename } from "@/lib/storage-keys";
import {
  isSafeFilename,
  resolveKey,
  streamWithRange,
} from "@/lib/storage-serve";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: { file: string } },
) {
  const file = params.file;
  if (!isSafeFilename(file)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const resolved = await resolveKey(lessonPdfKeyFromFilename(file));
  if (!resolved) return new NextResponse("not_found", { status: 404 });

  if (resolved.absPath) {
    return streamWithRange(resolved.absPath, "application/pdf", req);
  }
  const buf = await resolved.get();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/pdf",
      "content-length": String(buf.length),
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=604800, immutable",
    },
  });
}
