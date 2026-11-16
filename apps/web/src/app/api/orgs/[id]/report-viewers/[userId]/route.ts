import { NextResponse } from "next/server";
import { ReportViewerError, revokeReportViewer } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { reportViewerErrorStatus } from "@/lib/reportApi";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: { id: string; userId: string } }) {
  const actor = await requireUserId();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await revokeReportViewer(actor, params.id, params.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ReportViewerError) {
      return NextResponse.json({ error: e.code }, { status: reportViewerErrorStatus(e.code) });
    }
    throw e;
  }
}
