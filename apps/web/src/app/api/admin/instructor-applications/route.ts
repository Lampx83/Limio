import { NextResponse } from "next/server";
import { listInstructorApplications } from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";

export async function GET(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const raw = new URL(req.url).searchParams.get("status") ?? "pending";
  const status = (["pending", "approved", "rejected", "all"] as const).find((s) => s === raw);
  if (!status) return NextResponse.json({ error: "invalid_status" }, { status: 400 });

  const applications = await listInstructorApplications(status);
  return NextResponse.json({ applications });
}
