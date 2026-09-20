import { prisma } from "@feedbackme/db";
import { getRoomScope } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { examChannel, getExamSnapshot, roomChannel, seedAttemptsBulk, type AttemptLive, type LiveEvent } from "@/lib/exam-live-bus";
import { subscribe as streamSubscribe } from "@/lib/realtime/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A5.3 — Server-Sent Events stream for the instructor live dashboard.
 * Sends an initial `snapshot` then streams deltas from the Redis Stream
 * `rt:exam:{examId}`. Keep-alive ping every 15s so proxies don't drop.
 *
 * Tintin: backend is Redis Streams + Hash. Multi-container safe; clients
 * resume via Last-Event-ID (Stream id) on reconnect.
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
    select: { id: true, courseId: true, kind: true },
  });
  if (!exam) return new Response("not_found", { status: 404 });

  const scope = await getRoomScope(userId, exam.id);
  if (!scope.isInstructor && scope.proctorRoomIds.length === 0) {
    return new Response("forbidden", { status: 403 });
  }

  // ?roomId= — thu hẹp vào MỘT phòng, cho mọi vai chứ không chỉ giám thị.
  // Giám thị vẫn bị chặn trong các phòng mình coi; chọn phòng ngoài phạm vi
  // đó thì ra tập rỗng, không phải toàn bộ ca.
  const roomId = new URL(req.url).searchParams.get("roomId");
  const roomIds: string[] | null = !scope.isInstructor
    ? roomId
      ? scope.proctorRoomIds.filter((r) => r === roomId)
      : scope.proctorRoomIds
    : roomId
      ? [roomId]
      : null;

  let allowedCandidateIds: Set<string> | null = null;
  if (roomIds !== null) {
    const cands = await prisma.examCandidate.findMany({
      where: { examId: exam.id, roomId: { in: roomIds } },
      select: { id: true },
    });
    allowedCandidateIds = new Set(cands.map((c) => c.id));
  }

  // ?sessionId=<uuid> — giới hạn vào MỘT ca thi.
  //
  // Có nó thì BỎ cửa sổ 24h: chính ca đã bó tập bài làm rồi, mà cửa sổ 24h
  // khiến ca thi tuần trước mở ra là trống trơn. Giám sát một ca đang chạy và
  // xem lại một ca đã đóng là cùng một màn hình, chỉ khác thời điểm.
  const sessionId = new URL(req.url).searchParams.get("sessionId");

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await prisma.examAttempt.findMany({
    where: {
      examId: exam.id,
      ...(sessionId
        ? {
            OR: [
              { sessionId },
              { sessionId: null, candidate: { sessionId } },
            ],
          }
        : { startedAt: { gt: since } }),
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
      // Ô đỏ trên thẻ giám sát là thứ giáo viên đọc như "đáng ngờ", nên
      // KHÔNG đếm network_lost: mất wifi là chuyện hạ tầng, không phải hành
      // vi của thí sinh. Sự cố mạng vẫn được ghi và vẫn hiện đủ ở trang chi
      // tiết từng bài làm — chỉ là không thổi phồng con số cảnh báo.
      _count: {
        select: {
          incidents: { where: { type: { not: "network_lost" } } },
        },
      },
    },
    orderBy: { startedAt: "asc" },
  });
  // A6.5 — Vấn đáp AI không có ExamQuestion và không giới hạn số câu hỏi nên không có "tổng câu" (0).
  const totalQuestions =
    exam.kind === "oral"
      ? 0
      : await prisma.examQuestion.count({ where: { examId: exam.id } });
  const examMode = (
    await prisma.exam.findUnique({
      where: { id: exam.id },
      select: { accessMode: true },
    })
  )?.accessMode;

  const seedLive: AttemptLive[] = rows.map((r) => {
    const subjectType: "user" | "open" | "assigned" = r.userId
      ? "user"
      : r.candidate?.accessCode
        ? "assigned"
        : examMode === "assigned_code"
          ? "assigned"
          : "open";
    return {
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
      lastSeenAt:
        r.lastHeartbeatAt?.getTime() ??
        r.submittedAt?.getTime() ??
        r.startedAt.getTime(),
      resumeCount: r.resumeCount,
    };
  });
  await seedAttemptsBulk(exam.id, seedLive);

  // Danh sách bài làm được phép đẩy qua luồng. Null = đẩy hết.
  // Lọc theo phòng của giám thị VÀ/HOẶC theo ca — có bất kỳ ràng buộc nào thì
  // phải chốt danh sách, nếu không luồng sẽ đẩy cả bài của ca khác vào màn
  // hình đang xem một ca.
  const allowedAttemptIds: Set<string> | null =
    allowedCandidateIds === null && !sessionId
      ? null
      : new Set(rows.map((r) => r.id));

  const encoder = new TextEncoder();
  const abortController = new AbortController();
  const onAbort = () => abortController.abort();
  req.signal.addEventListener("abort", onAbort);

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: LiveEvent | { type: "ping" }, id?: string) => {
        if (closed) return;
        try {
          const prefix = id ? `id: ${id}\n` : "";
          controller.enqueue(
            encoder.encode(`${prefix}data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          // already closed
        }
      };

      const initialSnapshot = (await getExamSnapshot(exam.id)).filter(
        (a) => allowedAttemptIds === null || allowedAttemptIds.has(a.attemptId),
      );
      send({ type: "snapshot", attempts: initialSnapshot });

      const keepalive = setInterval(() => send({ type: "ping" }), 15_000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepalive);
        abortController.abort();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener("abort", close);

      // Resume cursor: "$" = only new events since now (snapshot above covers history).
      const sinceId =
        req.headers.get("last-event-id") ?? req.headers.get("Last-Event-ID") ?? "$";

      try {
        // Nghe kênh PHÒNG khi phạm vi đúng một phòng — bỏ được phần lớn lưu
        // lượng ngay ở tầng Redis thay vì nhận hết rồi lọc. Nhiều hơn một
        // phòng (giám thị coi 2 phòng) thì vẫn nghe kênh đề: subscribe chỉ
        // nhận một kênh, và lọc phía dưới đã đúng sẵn.
        const channel =
          roomIds !== null && roomIds.length === 1
            ? roomChannel(exam.id, roomIds[0]!)
            : examChannel(exam.id);

        for await (const events of streamSubscribe(
          channel,
          sinceId,
          abortController.signal,
        )) {
          if (events.length === 0) continue; // BLOCK timeout — keepalive fires separately
          for (const { id, data } of events) {
            const e = data as LiveEvent;
            if (allowedAttemptIds === null) {
              send(e, id);
              continue;
            }
            const attemptId =
              "attemptId" in e
                ? e.attemptId
                : "attempt" in e
                  ? e.attempt.attemptId
                  : null;
            if (attemptId === null) {
              send(e, id);
              continue;
            }
            if (allowedAttemptIds.has(attemptId)) {
              send(e, id);
              continue;
            }
            if (e.type !== "attempt.started") continue;
            try {
              const a = await prisma.examAttempt.findUnique({
                where: { id: attemptId },
                select: {
                  candidateId: true,
                  sessionId: true,
                  candidate: { select: { sessionId: true } },
                },
              });
              if (!a) continue;
              const roomOk =
                allowedCandidateIds === null ||
                (!!a.candidateId && allowedCandidateIds.has(a.candidateId));
              const sessionOk =
                !sessionId ||
                a.sessionId === sessionId ||
                a.candidate?.sessionId === sessionId;
              if (roomOk && sessionOk) {
                allowedAttemptIds.add(attemptId);
                send(e, id);
              }
            } catch {
              // skip
            }
          }
        }
      } catch {
        // stream aborted or transient — close out
      } finally {
        close();
      }
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
