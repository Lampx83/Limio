import { NextResponse } from "next/server";
import { liveResourceKeyFromFilename } from "@/lib/storage-keys";
import { isSafeFilename, resolveKey } from "@/lib/storage-serve";

export const runtime = "nodejs";

// Sandbox CSP cho .html — GIỐNG HỆT /api/lesson-media/html/[file]: file HTML
// giáo viên tự tải lên là nội dung không tin cậy dù nằm trên origin của
// mình. Header này áp dụng dù mở trực tiếp (target="_blank", cách
// ResourceContent.tsx dùng) hay lỡ bị nhúng iframe ở đâu đó — không có
// allow-same-origin nên không đọc được cookie/session của Limio.
const SANDBOX_CSP =
  "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox";

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  html: "text/html; charset=utf-8",
  mp4: "video/mp4",
  webm: "video/webm",
  zip: "application/zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain; charset=utf-8",
};

export async function GET(_req: Request, { params }: { params: { file: string } }) {
  const file = params.file;
  if (!isSafeFilename(file)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const resolved = await resolveKey(liveResourceKeyFromFilename(file));
  if (!resolved) return new NextResponse("not_found", { status: 404 });

  const buf = await resolved.get();
  const ext = (file.split(".").pop() ?? "").toLowerCase();
  const contentType = CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream";

  const headers: Record<string, string> = {
    "content-type": contentType,
    "content-length": String(buf.length),
    "cache-control": "public, max-age=604800, immutable",
    "x-content-type-options": "nosniff",
  };
  if (ext === "html") {
    headers["content-security-policy"] = SANDBOX_CSP;
  }

  return new NextResponse(new Uint8Array(buf), { headers });
}
