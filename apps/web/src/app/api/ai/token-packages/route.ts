import { NextResponse } from "next/server";
import { listActivePackages } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** Các gói token đang bán. */
export async function GET() {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ packages: await listActivePackages() });
}
