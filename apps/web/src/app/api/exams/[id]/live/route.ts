import { prisma } from "@feedbackme/db";
import { getRoomScope } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import {
  getExamSnapshot,
  seedAttempt,
  subscribe,
  type AttemptLive,
  type LiveEvent,
} from "@/lib/exam-live-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A5.3 — Server-Sent Events stream for the instructor live dashboard.
 * Sends an initial `snapshot` then streams deltas published by the bus.
 * Keep-alive ping every 15s so proxies don't drop the connection.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return new Response("unauthorized", { status: 401 });

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: { id: true, courseId: true },
  });
  if (!exam) return new Response("not_found", { status: 404 });

  // P1 — instructor sees everything; room proctor sees only attempts of
  // candidates in their proctored rooms; grader has no live access (chấm
  // happens post-submission). No room role at all = forbidden.
  const scope = await getRoomScope(userId, exam.id);
  if (!scope.isInstructor && scope.proctorRoomIds.length === 0) {
    return new Response("forbidden", { status: 403 });
  }

  // Build the proctor's allowed candidate set. null = full access.
  let allowedCandidateIds: Set<string> | null = null;
  if (!scope.isInstructor) {
    const cands = await prisma.examCandidate.findMany({
      where: { examId: exam.id, roomId: { in: scope.proctorRoomIds } },
      select: { id: true },
    });
    allowedCandidateIds = new Set(cands.map((c) => c.id));
  }

  // Seed the live cache with whatever is in DB right now. We only care about
  // attempts that started in the last 24h — older ones are historical.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await prisma.examAttempt.findMany({
    where: {
      examId: exam.id,
      startedAt: { gt: since },
      ...(allowedCandidateIds !== null
        ? { candidateId: { in: [...allowedCandidateIds] } }
        : {}),
    },
    select: {
      id: true,
      userId: true,
      candidateId: true,
      candidateDisplayName: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      durationSec: true,
      resumeCount: true,
      lastHeartbeatAt: true,
      user: { select: { displayName: true } },
      candidate: { select: { displayName: true, accessCode: true } },
      _count: { select: { incidents: true } },
    },
    orderBy: { startedAt: "asc" },
  });
  const totalQuestions = await prisma.examQuestion.count({
    where: { examId: exam.id },
  });
  // Distinguish open vs assigned candidates: open candidates have null
  // accessCode (they share Exam.openCode); assigned have their own.
  // Fall back to exam.accessMode if candidate row missing for some reason.
  const examMode = (
    await prisma.exam.findUnique({
      where: { id: exam.id },
      select: { accessMode: true },
    })
  )?.accessMode;

  for (const r of rows) {
    const subjectType: "user" | "open" | "assigned" = r.userId
      ? "user"
      : r.candidate?.accessCode
        ? "assigned"
        : examMode === "assigned_code"
          ? "assigned"
          : "open";
    const live: AttemptLive = {
      attemptId: r.id,
      userId: r.userId,
      userName:
        r.user?.displayName ??
        r.candidate?.displayName ??
        r.candidateDisplayName ??
        null,
      subjectType,
      status: r.status,
      startedAt: r.startedAt.getTime(),
      expiresAt: r.startedAt.getTime() + r.durationSec * 1000,
      submittedAt: r.submittedAt?.getTime() ?? null,
      answeredQuestionIds: [],
      totalQuestions,
      incidentCount: r._count.incidents,
      // Prefer the persisted lastHeartbeatAt (survives Node restarts).
      // Falls back to submittedAt or startedAt for legacy rows before M1.
      lastSeenAt:
        r.lastHeartbeatAt?.getTime() ??
        r.submittedAt?.getTime() ??
        r.startedAt.getTime(),
      resumeCount: r.resumeCount,
    };
    seedAttempt(exam.id, live);
  }

  // Track which attemptIds this subscriber may see. For instructors: null
  // (no filter). For proctor: starts with rows from the seeded query and
  // grows when a new attempt.started event arrives for a candidate in their
  // room (verified via a one-shot DB lookup).
  const allowedAttemptIds: Set<string> | null =
    allowedCandidateIds === null
      ? null
      : new Set(rows.map((r) => r.id));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: LiveEvent | { type: "ping" }) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          // Stream already closed — ignore.
        }
      };

      const initialSnapshot = getExamSnapshot(exam.id).filter(
        (a) => allowedAttemptIds === null || allowedAttemptIds.has(a.attemptId),
      );
      send({ type: "snapshot", attempts: initialSnapshot });

      const unsubscribe = subscribe(exam.id, async (e) => {
        if (allowedAttemptIds === null) {
          send(e);
          return;
        }
        // Identify the attemptId on the event. Snapshot/broadcast events
        // are exam-scoped and have no attemptId — always forward.
        const attemptId =
          "attemptId" in e ? e.attemptId : "attempt" in e ? e.attempt.attemptId : null;
        if (attemptId === null) {
          send(e);
          return;
        }
        if (allowedAttemptIds.has(attemptId)) {
          send(e);
          return;
        }
        // New attempt that wasn't in our seed. Only `attempt.started` can
        // introduce one for a candidate in our room mid-session — verify
        // membership before forwarding.
        if (e.type !== "attempt.started") return;
        try {
          const a = await prisma.examAttempt.findUnique({
            where: { id: attemptId },
            select: { candidateId: true },
          });
          if (
            a?.candidateId &&
            allowedCandidateIds!.has(a.candidateId)
          ) {
            allowedAttemptIds.add(attemptId);
            send(e);
          }
        } catch {
          // Swallow — better to miss one event than break the stream.
        }
      });
      const keepalive = setInterval(() => send({ type: "ping" }), 15_000);

      const close = () => {
        clearInterval(keepalive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
