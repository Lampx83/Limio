import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { storageFor } from "@/lib/storage";
import { lessonVideoKey } from "@/lib/storage-keys";
import { resolveVideoMime, SUPPORTED_VIDEO_TYPES, VIDEO_MAX_BYTES } from "@/lib/videoUpload";

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

const MIME_TO_EXT: Record<string, string> = Object.fromEntries(SUPPORTED_VIDEO_TYPES.map((m) => [m.mime, m.ext]));

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
  if (file.size > VIDEO_MAX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", details: { maxBytes: VIDEO_MAX_BYTES } },
      { status: 413 },
    );
  }
  // Loại tệp do trình duyệt báo có thể rỗng (Safari, .mkv/.mov): dựa vào đuôi tệp khi đó.
  const mime = resolveVideoMime(file.type, file.name);
  if (!mime) {
    return NextResponse.json(
      {
        error: "unsupported_media_type",
        details: { allowed: SUPPORTED_VIDEO_TYPES.map((m) => m.mime) },
      },
      { status: 415 },
    );
  }

  const ext = MIME_TO_EXT[mime] ?? "bin";
  const now = new Date();
  const suffix = randomBytes(8).toString("hex");
  const filename = `${userId}-${now.getTime()}-${suffix}.${ext}`;
  const key = lessonVideoKey(now, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await storageFor(key).put(key.key, buf, mime);

  return NextResponse.json(
    {
      ok: true,
      url: `/api/lesson-media/videos/${filename}`,
      filename,
      sizeBytes: file.size,
      mime,
    },
    { status: 201 },
  );
}
