import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { storageFor } from "@/lib/storage";
import { liveResourceKey } from "@/lib/storage-keys";

export const runtime = "nodejs";

// Upload chung cho slide "Nội dung" chèn tài nguyên (pdf/file/html_block/
// video) — 1 endpoint, giới hạn theo `kind` gửi kèm thay vì 1 route/loại như
// bên lesson-media (ở đó tách route vì còn có cuepoint/transcript riêng cho
// video; slide Limio-Live không cần).
const LIMITS: Record<string, { maxBytes: number; mime: Record<string, string> }> = {
  pdf: { maxBytes: 10 * 1024 * 1024, mime: { "application/pdf": "pdf" } },
  html_block: { maxBytes: 10 * 1024 * 1024, mime: { "text/html": "html" } },
  video: {
    maxBytes: 50 * 1024 * 1024,
    mime: { "video/mp4": "mp4", "video/webm": "webm" },
  },
  file: {
    maxBytes: 20 * 1024 * 1024,
    mime: {
      "application/pdf": "pdf",
      "application/zip": "zip",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "application/vnd.ms-powerpoint": "ppt",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
      "application/vnd.ms-excel": "xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
      "image/png": "png",
      "image/jpeg": "jpg",
      "text/plain": "txt",
    },
  },
};

export async function POST(req: Request) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }

  const kind = form.get("kind");
  const limits = typeof kind === "string" ? LIMITS[kind] : undefined;
  if (!limits) {
    return NextResponse.json(
      { error: "validation_failed", details: { allowedKinds: Object.keys(LIMITS) } },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "validation_failed", details: "no_file" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "validation_failed", details: "empty_file" }, { status: 400 });
  }
  if (file.size > limits.maxBytes) {
    return NextResponse.json(
      { error: "file_too_large", details: { maxBytes: limits.maxBytes } },
      { status: 413 },
    );
  }
  const ext = limits.mime[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "unsupported_media_type", details: { allowed: Object.keys(limits.mime) } },
      { status: 415 },
    );
  }

  const now = new Date();
  const suffix = randomBytes(8).toString("hex");
  const filename = `${userId}-${now.getTime()}-${suffix}.${ext}`;
  const key = liveResourceKey(now, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await storageFor(key).put(key.key, buf, file.type);

  return NextResponse.json(
    {
      ok: true,
      url: `/api/limio-live-resource/${filename}`,
      filename: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
    },
    { status: 201 },
  );
}
