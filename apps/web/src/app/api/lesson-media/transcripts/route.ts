import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { storageFor } from "@/lib/storage";
import { lessonTranscriptKey } from "@/lib/storage-keys";

export const runtime = "nodejs";

/**
 * A2.7 — Transcript upload for the interactive-transcript feature (YouTube
 * videos only). Accepts WebVTT or SRT text files; parsing into timed cues
 * happens client-side (see lib/transcript.ts), so this route only stores
 * the raw file and hands back a URL, same shape as the pdf/video uploaders.
 */

const MAX_TRANSCRIPT_BYTES = 2 * 1024 * 1024; // 2 MB — plain text, generous
const EXT_BY_NAME = /\.(vtt|srt)$/i;

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
  if (file.size > MAX_TRANSCRIPT_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", details: { maxBytes: MAX_TRANSCRIPT_BYTES } },
      { status: 413 },
    );
  }
  const m = EXT_BY_NAME.exec(file.name);
  if (!m) {
    return NextResponse.json(
      { error: "unsupported_media_type", details: { allowed: [".vtt", ".srt"] } },
      { status: 415 },
    );
  }
  const ext = m[1]!.toLowerCase();

  const now = new Date();
  const suffix = randomBytes(8).toString("hex");
  const filename = `${userId}-${now.getTime()}-${suffix}.${ext}`;
  const key = lessonTranscriptKey(now, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await storageFor(key).put(key.key, buf, "text/plain; charset=utf-8");

  return NextResponse.json(
    {
      ok: true,
      url: `/api/lesson-media/transcripts/${filename}`,
      filename,
      sizeBytes: file.size,
    },
    { status: 201 },
  );
}
