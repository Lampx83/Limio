import { NextResponse } from "next/server";
import {
  createExamRoom,
  getExamSession,
  listExamRoomsForSession,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const rooms = await listExamRoomsForSession(userId, params.id);
    return NextResponse.json({ rooms });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    // Existing createExamRoom takes examId and auto-ensures session. We resolve
    // examId from sessionId so the route URL is session-scoped (matches IA).
    // The auto-ensure step will return the same session we passed.
    const session = await getExamSession(userId, params.id);
    const r = await createExamRoom(userId, session.examId, body);
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
