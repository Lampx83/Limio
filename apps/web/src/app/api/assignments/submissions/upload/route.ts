import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { storageFor } from "@/lib/storage";
import { submissionKey } from "@/lib/storage-keys";

export const runtime = "nodejs";

/**
 * Generic submission attachment upload for generative activities (image,
 * video, audio, concept-map files, generic file). Returns a URL pointing
 * at /api/assignment-media/[file] which streams the blob back.
 *
 * Auth: any authenticated user. Per-assignment scoping happens at submit time
 * (the URL is just stored as `attachmentUrl` on AssignmentSubmission).
 */

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB

const MIME_TO_EXT: Record<string, { ext: string; kind: string }> = {
  // image
  "image/png": { ext: "png", kind: "image" },
  "image/jpeg": { ext: "jpg", kind: "image" },
  "image/webp": { ext: "webp", kind: "image" },
  "image/gif": { ext: "gif", kind: "image" },
  "image/svg+xml": { ext: "svg", kind: "image" },
  // audio
  "audio/mpeg": { ext: "mp3", kind: "audio" },
  "audio/ogg": { ext: "ogg", kind: "audio" },
  "audio/wav": { ext: "wav", kind: "audio" },
  "audio/webm": { ext: "webm", kind: "audio" },
  // video
  "video/mp4": { ext: "mp4", kind: "video" },
  "video/webm": { ext: "webm", kind: "video" },
  "video/quicktime": { ext: "mov", kind: "video" },
  // generic / concept-map exports
  "application/pdf": { ext: "pdf", kind: "file" },
  "application/json": { ext: "json", kind: "file" },
  "application/zip": { ext: "zip", kind: "file" },
  "text/plain": { ext: "txt", kind: "file" },
};

const ALLOWED_MIME = new Set(Object.keys(MIME_TO_EXT));

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "validation_failed", details: "no_file" },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json(
      { error: "validation_failed", details: "empty_file" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", details: { maxBytes: MAX_BYTES } },
      { status: 413 },
    );
  }
  const meta = MIME_TO_EXT[file.type];
  if (!meta || !ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      {
        error: "unsupported_media_type",
        details: { allowed: Object.keys(MIME_TO_EXT) },
      },
      { status: 415 },
    );
  }

  const now = new Date();
  const suffix = randomBytes(8).toString("hex");
  const filename = `${userId}-${now.getTime()}-${suffix}.${meta.ext}`;
  const key = submissionKey(now, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await storageFor(key).put(key.key, buf, file.type);

  return NextResponse.json(
    {
      ok: true,
      url: `/api/assignment-media/${filename}`,
      filename,
      sizeBytes: file.size,
      mime: file.type,
      kind: meta.kind,
    },
    { status: 201 },
  );
}
