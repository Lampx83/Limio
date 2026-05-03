import { NextResponse } from "next/server";
import { listUserBadges } from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const items = await listUserBadges(userId);
  return NextResponse.json({ items });
}
