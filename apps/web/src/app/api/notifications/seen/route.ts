import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markNotificationsSeen } from "@/lib/notifications";

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await markNotificationsSeen(userId);
  return NextResponse.json({ ok: true });
}
