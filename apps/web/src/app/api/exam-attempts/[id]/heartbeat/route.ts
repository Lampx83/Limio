import { NextResponse } from "next/server";
import { logExamIncident } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireExamSubject } from "@/lib/session";
import { clientIp } from "@/lib/rate-limit";
import {
  checkAndUpdateFingerprint,
  getExamIdForAttempt,
  markHeartbeatDbWritten,
  recordHeartbeat,
  recordIncident,
  registerAttempt,
  shouldFlushHeartbeatToDb,
} from "@/lib/exam-live-bus";

export const runtime = "nodejs";

/**
 * A5.3 — Heartbeat from the live exam page. Fire-and-forget every ~10s.
 * Accepted from either a User (NextAuth) or candidate (exam_session cookie).
 *
 * Two-tier write strategy:
 *   - Bus publish (in-memory): every call, sub-second freshness for the
 *     instructor live dashboard.
 *   - DB UPDATE of ExamAttempt.lastHeartbeatAt: coalesced to ≤ 1 / 30s / attempt
 *     so 500 SV × heartbeat 10s ≠ 50 row updates/s.
 *
 * Never writes to LearningEvent (would flood the append-only log, §5.1).
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const subject = await requireExamSubject(params.id);
  if (!subject)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Resolve examId from cache first; fall back to DB lookup if the dashboard
  // hasn't seeded the cache yet for this attempt.
  let examId = getExamIdForAttempt(params.id);
  if (!examId) {
    const a = await prisma.examAttempt.findUnique({
      where: { id: params.id },
      select: { id: true, examId: true, userId: true, candidateId: true, status: true },
    });
    if (!a || a.status !== "in_progress") {
      return NextResponse.json({ ok: true });
    }
    if (subject.kind === "user" && a.userId !== subject.userId) {
      return NextResponse.json({ ok: true });
    }
    if (
      subject.kind === "candidate" &&
      (a.candidateId !== subject.candidateId || a.id !== subject.attemptId)
    ) {
      return NextResponse.json({ ok: true });
    }
    examId = a.examId;
    registerAttempt(params.id, examId);
  }

  recordHeartbeat(params.id);

  // A5.8.D4 — cookie-share detector. Compare device fingerprint vs the prior
  // heartbeat. If they diverge inside a short window, the exam_session cookie
  // is in use on 2 devices at the same time → log multi_tab incident.
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") ?? "unknown";
  const fp = checkAndUpdateFingerprint(params.id, ip, ua);
  if (fp) {
    try {
      await logExamIncident(subject, params.id, {
        type: "multi_tab",
        payload: {
          reason: "cookie_share",
          prev: { ip: fp.previousDifferent.ip, ua: fp.previousDifferent.ua.slice(0, 80) },
          curr: { ip, ua: ua.slice(0, 80) },
        },
      });
      recordIncident(params.id, "multi_tab");
    } catch {
      // Best-effort — heartbeat must not fail because incident write failed.
    }
  }

  if (shouldFlushHeartbeatToDb(params.id)) {
    // Guard with subject id so a stolen attemptId can't bump someone else's row.
    const where =
      subject.kind === "user"
        ? { id: params.id, userId: subject.userId, status: "in_progress" as const }
        : {
            id: params.id,
            candidateId: subject.candidateId,
            status: "in_progress" as const,
          };
    const r = await prisma.examAttempt.updateMany({
      where,
      data: { lastHeartbeatAt: new Date() },
    });
    if (r.count > 0) markHeartbeatDbWritten(params.id);
  }

  return NextResponse.json({ ok: true });
}
