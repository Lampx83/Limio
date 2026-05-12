import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { storageFor } from "@/lib/storage";
import { lessonVideoKey } from "@/lib/storage-keys";

export const runtime = "nodejs";

/**
 * Lesson video upload (Phase 0 / dev-friendly).
 *
 * Stores raw video files under the public storage layer at
 * `lesson-media/videos/{yyyy}/{mm}/{filename}`. Returns a URL pointing at
 * the /api/lesson-media/videos/[file] streaming endpoint, which the
 * AddContentItemForm video branch then uses as the `url` payload.
 *
 * Auth: any authenticated user (instructor/admin) may upload. We don't
 * scope by lesson here because uploads happen before the content row is
 * created and the same blob may be reused. Cleanup of orphaned blobs is
 * a separate background task.
 *
 * Production note: real deployment should swap local FS for S3/R2 (see
 * CLAUDE.md tech stack); the storage adapter abstracts that switch.
 */

const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB

// Route-file exports beyond HTTP method handlers / `runtime` confuse the
// Next.js route type-generator, so keep this list local. The form duplicates
// the human-facing list separately on the client.
const SUPPORTED_VIDEO_MIMES: ReadonlyArray<{
  mime: string;
  ext: string;
  label: string;
}> = [
  { mime: "video/mp4", ext: "mp4", label: "MP4 (H.264 / H.265)" },
  { mime: "video/webm", ext: "webm", label: "WebM (VP8/VP9)" },
  { mime: "video/ogg", ext: "ogv", label: "Ogg Theora" },
  { mime: "video/quicktime", ext: "mov", label: "MOV (QuickTime)" },
  { mime: "video/x-matroska", ext: "mkv", label: "MKV" },
];

const ALLOWED_MIME = new Set(SUPPORTED_VIDEO_MIMES.map((m) => m.mime));
const MIME_TO_EXT: Record<string, string> = Object.fromEntries(
  SUPPORTED_VIDEO_MIMES.map((m) => [m.mime, m.ext]),
);

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
  if (file.size > MAX_VIDEO_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", details: { maxBytes: MAX_VIDEO_BYTES } },
      { status: 413 },
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      {
        error: "unsupported_media_type",
        details: { allowed: SUPPORTED_VIDEO_MIMES.map((m) => m.mime) },
      },
      { status: 415 },
    );
  }

  const ext = MIME_TO_EXT[file.type] ?? "bin";
  const now = new Date();
  const suffix = randomBytes(8).toString("hex");
  const filename = `${userId}-${now.getTime()}-${suffix}.${ext}`;
  const key = lessonVideoKey(now, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await storageFor(key).put(key.key, buf, file.type);

  return NextResponse.json(
    {
      ok: true,
      url: `/api/lesson-media/videos/${filename}`,
      filename,
      sizeBytes: file.size,
      mime: file.type,
    },
    { status: 201 },
  );
}
