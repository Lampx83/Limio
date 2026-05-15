import { NextResponse } from "next/server";
import { listMyProctorRooms } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

// GET /api/proctor/rooms — rooms where caller is the assigned proctor.
export async function GET() {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const rooms = await listMyProctorRooms(userId);
    return NextResponse.json({ rooms });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
