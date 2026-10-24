import { NextResponse } from "next/server";
import { createNoteCorrection } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { noteDto } from "@/lib/classNotes";

export const runtime = "nodejs";

/** Đính chính một nhận xét đã gửi (C4.11): tạo bản nháp mới chép nội dung cũ; gửi kèm nhãn "Đính chính". */
export async function POST(_req: Request, { params }: { params: { noteId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(noteDto(await createNoteCorrection(userId, params.noteId)), { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
