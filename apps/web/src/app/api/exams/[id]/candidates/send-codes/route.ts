import { NextResponse } from "next/server";
import { sendCodesToCandidates, sendTemplatedEmail } from "@feedbackme/core-lms";
import { formatDateTime } from "@/lib/datetime";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * A5.8 Q3 — Send the per-candidate accessCode email batch. Inline send (≤200
 * candidates expected). Larger batches need a queue (P5).
 *
 * Uses the admin-editable `exam.access_code` template; resolves per-org
 * override based on the exam's owning course's organizationId.
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

  const fmtDateTime = (d: Date) => formatDateTime(d);

  try {
    const r = await sendCodesToCandidates(userId, {
      examId: params.id,
      baseUrl,
      send: async (i) => {
        const res = await sendTemplatedEmail({
          key: "exam.access_code",
          to: i.to,
          organizationId: i.organizationId,
          variables: {
            candidateName: i.candidateName,
            examTitle: i.examTitle,
            accessCode: i.accessCode,
            claimUrl: i.claimUrl,
            examOpensAt: fmtDateTime(i.examOpensAt),
            examClosesAt: fmtDateTime(i.examClosesAt),
            examDurationMin: i.examDurationMin,
          },
        });
        return { delivered: res.delivered, loggedOnly: res.loggedOnly, error: res.error };
      },
    });
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
