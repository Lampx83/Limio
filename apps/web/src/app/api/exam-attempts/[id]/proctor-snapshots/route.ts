import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { requireExamSubject } from "@/lib/session";
import { storageFor } from "@/lib/storage";
import { proctorSnapshotKey } from "@/lib/storage-keys";

export const runtime = "nodejs";

/**
 * A7.7.5 — Proctor snapshot upload (P3 standard).
 *
 * Stub pipeline: accepts a webcam frame (or any small image) from the candidate's
 * browser during an attempt and writes it to `private/proctor-snapshots/` plus
 * an `AttemptProctorSnapshot` row. Client controls the cadence (periodic or
 * event-triggered) via the `kind` field; the server doesn't poll.
 *
 * Auth: candidate cookie owning the attempt OR User session with edit-course
 * rights. Stub accepts only the candidate path for now — instructor retro
 * import is out of scope.
 *
 * Body: multipart/form-data
 *   - file: image blob (≤ MAX_BYTES)
 *   - kind: "periodic" | "on_event"
 */

const MAX_MB = 2;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const subject = await requireExamSubject(params.id);
  if (!subject)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Authorise against the attempt — only the attempt's own candidate / user.
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, candidateId: true, status: true },
  });
  if (!attempt)
    return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
  if (attempt.status !== "in_progress")
    return NextResponse.json(
      { error: "attempt_not_in_progress" },
      { status: 409 },
    );
  const ok =
    subject.kind === "user"
      ? attempt.userId === subject.userId
      : attempt.candidateId === subject.candidateId &&
        subject.attemptId === attempt.id;
  if (!ok)
    return NextResponse.json(
      { error: "attempt_belongs_to_other" },
      { status: 403 },
    );

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }
  const file = form.get("file");
  const kindRaw = form.get("kind");
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json(
      { error: "validation_failed", details: "no_file" },
      { status: 400 },
    );
  if (file.size > MAX_BYTES)
    return NextResponse.json(
      { error: "file_too_large", details: { maxBytes: MAX_BYTES } },
      { status: 413 },
    );
  const ext = ALLOWED[file.type];
  if (!ext)
    return NextResponse.json(
      { error: "unsupported_media_type", details: { allowed: Object.keys(ALLOWED) } },
      { status: 415 },
    );
  const kind = kindRaw === "on_event" ? "on_event" : "periodic";

  const now = new Date();
  const suffix = randomBytes(8).toString("hex");
  const filename = `${attempt.id}-${now.getTime()}-${suffix}.${ext}`;
  const key = proctorSnapshotKey(now, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await storageFor(key).put(key.key, buf, file.type);

  const row = await prisma.attemptProctorSnapshot.create({
    data: {
      attemptId: attempt.id,
      kind,
      storageKey: key.key,
      mimeType: file.type,
      sizeBytes: file.size,
      capturedAt: now,
    },
    select: { id: true, storageKey: true, capturedAt: true },
  });

  return NextResponse.json({ ok: true, snapshot: row }, { status: 201 });
}
