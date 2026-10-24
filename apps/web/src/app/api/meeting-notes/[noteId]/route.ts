import { NextResponse } from "next/server";
import { approveMeetingNote, unapproveMeetingNote, updateMeetingNote } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { noteDto } from "@/lib/classNotes";

export const runtime = "nodejs";

/** Sửa chữ / ghi chú, hoặc duyệt / bỏ duyệt một bản nhận xét: { body?, teacherHint?, action?: "approve" | "unapprove" }. */
export async function PATCH(req: Request, { params }: { params: { noteId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const raw = (await readJson(req)) as { body?: string; teacherHint?: string | null; action?: string } | null;
  try {
    let note;
    if (raw?.body !== undefined || raw?.teacherHint !== undefined) {
      note = await updateMeetingNote(userId, params.noteId, { body: raw?.body, teacherHint: raw?.teacherHint });
    }
    if (raw?.action === "approve") note = await approveMeetingNote(userId, params.noteId);
    else if (raw?.action === "unapprove") note = await unapproveMeetingNote(userId, params.noteId);
    if (!note) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    return NextResponse.json(noteDto(note));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
