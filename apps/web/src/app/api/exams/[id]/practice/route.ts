import { NextResponse } from "next/server";
import { getPracticeOverview, startPracticeSession } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** LANG G5e — tổng quan luyện đề của đề thi thử (các phần, số câu chưa làm/từng sai, buổi đang dở). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await getPracticeOverview(userId, params.id));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/** Bắt đầu buổi luyện: { skills?, sectionIds?, all?, filter?, timed?, checkEnabled?, retryOfSessionId? }. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) ?? {};
  try {
    const r = await startPracticeSession(userId, params.id, body as Record<string, unknown>);
    return NextResponse.json(r, { status: r.resumed ? 200 : 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
