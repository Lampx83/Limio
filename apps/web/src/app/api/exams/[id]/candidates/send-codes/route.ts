import { NextResponse } from "next/server";
import { sendCodesToCandidates } from "@feedbackme/core-lms";
import { renderExamCodeEmail, sendEmail } from "@/lib/email";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * A5.8 Q3 — Send the per-candidate accessCode email batch. Inline send (≤200
 * candidates expected). Larger batches need a queue (P5).
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = host ? `${proto}://${host}` : "";
  try {
    const r = await sendCodesToCandidates(userId, {
      examId: params.id,
      baseUrl,
      send: async (i) => {
        const tmpl = renderExamCodeEmail({
          candidateName: i.candidateName,
          examTitle: i.examTitle,
          examOpensAt: i.examOpensAt,
          examClosesAt: i.examClosesAt,
          examDurationMin: i.examDurationMin,
          accessCode: i.accessCode,
          claimUrl: i.claimUrl,
        });
        return sendEmail({ to: i.to, subject: tmpl.subject, html: tmpl.html, text: tmpl.text });
      },
    });
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
