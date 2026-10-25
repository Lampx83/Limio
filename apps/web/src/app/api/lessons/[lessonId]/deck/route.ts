import { NextResponse } from "next/server";
import { z } from "zod";
import { attachLessonDeck, detachLessonDeck, getLessonDeckForEditor } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

// Bài giảng slide của bài học (docs/tieu-chi/nghe-giang-slide.md, AC1): xem, gắn, gỡ. Chỉ người sửa được khoá.

const AttachBody = z.object({ deckId: z.string().uuid(), replace: z.boolean().optional() });

export async function GET(_req: Request, { params }: { params: { lessonId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await getLessonDeckForEditor(userId, params.lessonId));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export async function PUT(req: Request, { params }: { params: { lessonId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = AttachBody.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    const { replacedDeckId } = await attachLessonDeck(userId, params.lessonId, parsed.data.deckId, { replace: parsed.data.replace });
    return NextResponse.json({ ok: true, replacedDeckId });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: { params: { lessonId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await detachLessonDeck(userId, params.lessonId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
