import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeMeetingNotes, listMeetingNotes, saveMeetingNote } from "@feedbackme/core-lms";
import { draftAllMeetingNotes, draftMeetingNote } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { noteDto, noteOpenaiOrNull } from "@/lib/classNotes";

export const runtime = "nodejs";

/** Danh sách nhận xét sau buổi (C4.6): mỗi học viên một dòng kèm bản nháp và trạng thái. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const view = await listMeetingNotes(userId, params.id);
    return NextResponse.json({
      ...view,
      rows: view.rows.map((r) => ({ ...r, note: r.note ? noteDto(r.note) : null, sentNotes: r.sentNotes.map(noteDto) })),
    });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

const DraftBody = z.object({
  action: z.enum(["draft_all", "draft_one"]),
  userId: z.string().min(1).optional(),
  hint: z.string().trim().max(500).nullish(),
  regenerate: z.boolean().optional(),
});

/** Soạn nháp: cho cả lớp một lượt (draft_all) hoặc một học viên kèm ghi chú nhanh (draft_one, C4.9). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = DraftBody.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  const body = parsed.data;
  try {
    await authorizeMeetingNotes(userId, params.id);
    const openai = await noteOpenaiOrNull();
    if (body.action === "draft_all") {
      return NextResponse.json(await draftAllMeetingNotes({ actorUserId: userId, meetingId: params.id, openai, regenerate: body.regenerate }));
    }
    if (!body.userId) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    return NextResponse.json(
      await draftMeetingNote({ actorUserId: userId, meetingId: params.id, userId: body.userId, hint: body.hint, openai, regenerate: body.regenerate }),
    );
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/** Giáo viên tự viết nhận xét hoặc lời nhắn cho một học viên (kể cả người vắng — C4.12). */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const raw = (await readJson(req)) as { userId?: string; body?: string; teacherHint?: string | null } | null;
  if (!raw?.userId) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    return NextResponse.json(noteDto(await saveMeetingNote(userId, params.id, raw.userId, { body: raw.body, teacherHint: raw.teacherHint })));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
