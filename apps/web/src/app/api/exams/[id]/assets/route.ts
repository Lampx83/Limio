import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  AUDIO_MAX_BYTES,
  AUDIO_MIME_TYPES,
  createAudioAsset,
  createImageAsset,
  ExamError,
  IMAGE_MAX_BYTES,
  IMAGE_MIME_TYPES,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { storageFor } from "@/lib/storage";
import { examAssetKey } from "@/lib/storage-keys";

export const runtime = "nodejs";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "weba",
  "audio/mp4": "m4a",
};

/**
 * Upload an image or audio asset for an exam passage.
 * multipart/form-data: file=<file>, altText=<string>, transcript=<string|optional>
 * Returns { assetId, url, s3Key, kind } — caller embeds the URL into passage
 * contentJson.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }
  const file = form.get("file");
  const altText = form.get("altText");
  const transcript = form.get("transcript");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "validation_failed", details: "no_file" },
      { status: 400 },
    );
  }

  const isImage = (IMAGE_MIME_TYPES as readonly string[]).includes(file.type);
  const isAudio = (AUDIO_MIME_TYPES as readonly string[]).includes(file.type);
  if (!isImage && !isAudio) {
    return NextResponse.json(
      {
        error: "unsupported_media_type",
        details: { allowed: [...IMAGE_MIME_TYPES, ...AUDIO_MIME_TYPES] },
      },
      { status: 415 },
    );
  }
  const maxBytes = isImage ? IMAGE_MAX_BYTES : AUDIO_MAX_BYTES;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: "file_too_large", details: { maxBytes } },
      { status: 413 },
    );
  }
  if (typeof altText !== "string" || altText.trim().length === 0) {
    return NextResponse.json({ error: "alt_text_required" }, { status: 400 });
  }

  const examId = params.id;
  const ext = EXT_BY_MIME[file.type]!;
  const now = new Date();
  const filename = `${examId}-${now.getTime()}-${randomBytes(8).toString("hex")}.${ext}`;
  const key = examAssetKey(now, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  const storage = storageFor(key);
  await storage.put(key.key, buf, file.type);

  try {
    const input = {
      s3Key: filename,
      mimeType: file.type,
      sizeBytes: file.size,
      altText: altText.trim(),
      ...(typeof transcript === "string" && transcript.trim().length > 0
        ? { transcript: transcript.trim() }
        : {}),
    };
    const r = isImage
      ? await createImageAsset(userId, examId, input)
      : await createAudioAsset(userId, examId, input);
    return NextResponse.json(
      {
        assetId: r.assetId,
        s3Key: filename,
        url: `/api/exam-assets/${filename}`,
        kind: isImage ? "image" : "audio",
      },
      { status: 201 },
    );
  } catch (e) {
    await storage.delete(key.key).catch(() => undefined);
    if (e instanceof ExamError) {
      const mapped = mapKnownError(e);
      if (mapped) return mapped;
    }
    throw e;
  }
}
