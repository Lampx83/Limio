/** Quyền "Xem báo cáo" của tổ chức (docs/tieu-chi/bao-cao-nha-xuat-ban.md, AC1). Chỉ OrgAdmin/Platform Admin. */
import { NextResponse } from "next/server";
import { grantReportViewer, listReportViewers, ReportViewerError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { reportViewerErrorStatus } from "@/lib/reportApi";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ viewers: await listReportViewers(userId, params.id) });
  } catch (e) {
    if (e instanceof ReportViewerError) {
      return NextResponse.json({ error: e.code }, { status: reportViewerErrorStatus(e.code) });
    }
    throw e;
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let email = "";
  try {
    const body = (await req.json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email : "";
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!email.trim()) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    const r = await grantReportViewer(userId, params.id, email);
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    if (e instanceof ReportViewerError) {
      return NextResponse.json({ error: e.code }, { status: reportViewerErrorStatus(e.code) });
    }
    throw e;
  }
}
