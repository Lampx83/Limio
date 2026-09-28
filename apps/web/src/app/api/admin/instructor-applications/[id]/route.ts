import { NextResponse } from "next/server";
import {
  approveInstructorApplication,
  rejectInstructorApplication,
  InstructorApplicationError,
} from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";

// Duyệt / từ chối một đơn xin làm giáo viên. Chỉ admin nền tảng.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { action?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  try {
    if (body.action === "approve") {
      const r = await approveInstructorApplication(adminId, params.id, baseUrl);
      return NextResponse.json({ status: "approved", emailSent: r.emailSent });
    }
    if (body.action === "reject") {
      const reason = typeof body.reason === "string" ? body.reason : "";
      const r = await rejectInstructorApplication(adminId, params.id, reason);
      return NextResponse.json({ status: "rejected", emailSent: r.emailSent });
    }
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  } catch (e) {
    if (e instanceof InstructorApplicationError) {
      const status =
        e.code === "not_found" ? 404 : e.code === "already_reviewed" ? 409 : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
