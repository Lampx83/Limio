import { NextResponse } from "next/server";
import { exportProfile } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const data = await exportProfile(userId);
  return NextResponse.json(data, {
    headers: { "Content-Disposition": `attachment; filename="profile-${userId}.json"` },
  });
}
