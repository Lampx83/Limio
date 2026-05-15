import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse } from "@feedbackme/core-lms";
import { renderExamCodeEmail } from "@/lib/email";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Render the exam-code email for the FIRST eligible candidate so the
 * instructor can eyeball the message before kicking off the actual batch
 * (see /send-codes POST). Also returns recipient stats so the confirm dialog
 * can show "X / Y sẽ nhận, Z bỏ qua vì thiếu email".
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const exam = await prisma.exam.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        courseId: true,
        title: true,
        openAt: true,
        closeAt: true,
        durationMin: true,
      },
    });
    if (!exam)
      return NextResponse.json({ error: "exam_not_found" }, { status: 404 });
    await assertCanEditCourse(userId, exam.courseId);

    const rows = await prisma.examCandidate.findMany({
      where: {
        examId: exam.id,
        disabledAt: null,
        accessCode: { not: null },
      },
      select: {
        displayName: true,
        accessCode: true,
        metadata: true,
      },
    });

    let withEmail = 0;
    let skipped = 0;
    let firstEligible: {
      displayName: string;
      email: string;
      accessCode: string;
    } | null = null;
    for (const c of rows) {
      const meta = c.metadata as Record<string, unknown> | null;
      const email = typeof meta?.email === "string" ? meta.email : null;
      if (!email || !c.accessCode) {
        skipped++;
        continue;
      }
      withEmail++;
      if (!firstEligible) {
        firstEligible = {
          displayName: c.displayName,
          email,
          accessCode: c.accessCode,
        };
      }
    }

    const h = req.headers;
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const proto = h.get("x-forwarded-proto") ?? "http";
    const baseUrl = host ? `${proto}://${host}` : "";

    if (!firstEligible) {
      return NextResponse.json({
        recipients: 0,
        skipped,
        preview: null,
      });
    }

    const tmpl = renderExamCodeEmail({
      candidateName: firstEligible.displayName,
      examTitle: exam.title,
      examOpensAt: exam.openAt,
      examClosesAt: exam.closeAt,
      examDurationMin: exam.durationMin,
      accessCode: firstEligible.accessCode,
      claimUrl: `${baseUrl.replace(/\/$/, "")}/exam/${firstEligible.accessCode}`,
    });

    return NextResponse.json({
      recipients: withEmail,
      skipped,
      preview: {
        candidate: firstEligible,
        subject: tmpl.subject,
        html: tmpl.html,
        text: tmpl.text,
      },
    });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
