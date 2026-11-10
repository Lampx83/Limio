import { NextResponse } from "next/server";
import { getAudioTranscriptForEditor, setAudioTranscript } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { isSafeFilename } from "@/lib/storage-serve";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Transcript của một audio trong đề (docs/tieu-chi/bai-doc-anh-audio-xoa-transcript.md, AC3). Chỉ người sửa được khoá chứa đề.
 * Transcript KHÔNG nằm trong tài liệu đoạn văn nên đi đường riêng này; học viên không có route nào để đọc nó.
 */
export async function GET(_req: Request, { params }: { params: { id: string; file: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isSafeFilename(params.file)) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    return NextResponse.json(await getAudioTranscriptForEditor(userId, params.id, params.file));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string; file: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isSafeFilename(params.file)) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  const body = (await readJson(req)) as { transcript?: unknown } | null;
  if (typeof body?.transcript !== "string") return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    await setAudioTranscript(userId, params.id, params.file, body.transcript);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
