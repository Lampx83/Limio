import { NextResponse } from "next/server";
import { renderExamCodeEmail, sendEmail } from "@/lib/email";
import { requireAdmin } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Dev/admin-only — render the exam-code email template + (optionally) send it
 * to a single address. Used to verify Resend wiring without queueing a real
 * candidate batch. Disabled in production unless explicitly debugged.
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    const admin = await requireAdmin();
    if (!admin)
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const send = searchParams.get("send");
  const tmpl = renderExamCodeEmail({
    candidateName: searchParams.get("name") ?? "Nguyễn Văn A",
    examTitle: searchParams.get("examTitle") ?? "Kỳ thi cuối kỳ — Kỹ năng mềm",
    examOpensAt: new Date(Date.now() + 60 * 60_000),
    examClosesAt: new Date(Date.now() + 4 * 60 * 60_000),
    examDurationMin: 90,
    accessCode: searchParams.get("code") ?? "X65DMJZD",
    claimUrl: `${new URL(req.url).origin}/exam/${searchParams.get("code") ?? "X65DMJZD"}`,
  });

  if (send) {
    const r = await sendEmail({
      to: send,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    });
    return NextResponse.json({ preview: tmpl, send: r });
  }
  // Render preview as HTML so instructor can eyeball it.
  if (searchParams.get("format") === "html") {
    return new NextResponse(tmpl.html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  return NextResponse.json({ preview: tmpl });
}
