import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { readJson } from "@/lib/apiHelpers";
import { allow, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * PR2.12 — Resolve `cohortCode` cho ca thi đang vào, trả info để SV confirm
 * trước khi claim. Public, không auth — nhưng gate theo session openCode đã
 * resolve được (tức SV phải có mã ca hợp lệ trước).
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  // ip="unknown" means XFF/X-Real-IP carried no public address — skip rather
  // than bucket every internal hop under one shared key (see rate-limit.ts).
  if (ip !== "unknown") {
    const burst = await allow("preview-cohort:burst", ip, 30, 60_000);
    if (!burst.ok) {
      return NextResponse.json(
        { error: "rate_limited", retryAfter: burst.retryAfterSec },
        { status: 429 },
      );
    }
  }

  const body = (await readJson(req)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  const rawCode = body.code;
  const rawCohort = body.cohortCode;
  if (typeof rawCode !== "string" || typeof rawCohort !== "string") {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  const code = rawCode.trim().toUpperCase();
  const cohortCode = rawCohort.trim().toUpperCase();
  if (!code || !cohortCode) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  // Resolve courseId via ExamSession.openCode first, fallback Exam.openCode.
  let courseId: string | null = null;
  const session = await prisma.examSession.findFirst({
    where: { openCode: code, accessMode: "open_code" },
    select: { exam: { select: { courseId: true } } },
  });
  if (session) courseId = session.exam.courseId;
  else {
    const exam = await prisma.exam.findUnique({
      where: { openCode: code },
      select: { courseId: true, accessMode: true },
    });
    if (!exam || exam.accessMode !== "open_code")
      return NextResponse.json({ error: "invalid_code" }, { status: 404 });
    courseId = exam.courseId;
  }

  const cohort = await prisma.courseSection.findFirst({
    where: { courseId, code: cohortCode },
    select: {
      id: true,
      name: true,
      instructor: { select: { displayName: true } },
    },
  });
  if (!cohort)
    return NextResponse.json({ error: "cohort_not_found" }, { status: 404 });

  return NextResponse.json({
    cohort: {
      id: cohort.id,
      name: cohort.name,
      instructorName: cohort.instructor?.displayName ?? null,
    },
  });
}
