import { NextResponse } from "next/server";
import { listEnrollmentsForUser } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const items = await listEnrollmentsForUser(userId);
  return NextResponse.json({ items });
}
