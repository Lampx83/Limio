import { NextResponse } from "next/server";
import { isAdmin, listIntegrationStatuses } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const statuses = await listIntegrationStatuses();
  return NextResponse.json({ statuses });
}
