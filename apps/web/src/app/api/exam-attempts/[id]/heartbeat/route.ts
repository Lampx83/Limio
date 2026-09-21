import { NextResponse } from "next/server";
import { logExamIncident } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireExamSubject } from "@/lib/session";
import { clientIp } from "@/lib/rate-limit";
import { allowInMemory } from "@/lib/in-memory-rate-limit";
import {
  checkAndUpdateFingerprint,
  getExamIdForAttempt,
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
  // At most 1 heartbeat per 8s per attempt — silently accept extras so the
  // client doesn't retry, but skip all processing to protect the DB.
  // Per-process in-memory limiter (not Redis): saves 1 round-trip on hot path.
  // Acceptable over-count: 3 replicas × 1/8s = worst-case 3/8s/attempt, still
  // far below DB/Redis budget. See lib/in-memory-rate-limit.ts.
  if (!allowInMemory(`heartbeat:${params.id}`, 8_000)) {
    return NextResponse.json({ ok: true });
  }

  const subject = await requireExamSubject(params.id);
  if (!subject)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Resolve examId from cache first; fall back to DB lookup if the dashboard
  // hasn't seeded the cache yet for this attempt.
  let examId = await getExamIdForAttempt(params.id);
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
    await registerAttempt(params.id, examId);
  }

  await recordHeartbeat(params.id);

  // A5.8.D4 — cookie-share detector. Compare device fingerprint vs the prior
  // heartbeat. If they diverge inside a short window, the exam_session cookie
  // is in use on 2 devices at the same time → log multi_tab incident.
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") ?? "unknown";
  const fp = await checkAndUpdateFingerprint(params.id, ip, ua);
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
      await recordIncident(params.id, "multi_tab");
    } catch {
      // Best-effort — heartbeat must not fail because incident write failed.
    }
  }

  if (await shouldFlushHeartbeatToDb(params.id)) {
    // Guard with subject id so a stolen attemptId can't bump someone else's row.
    const where =
      subject.kind === "user"
        ? { id: params.id, userId: subject.userId, status: "in_progress" as const }
        : {
            id: params.id,
            candidateId: subject.candidateId,
            status: "in_progress" as const,
          };
    await prisma.examAttempt.updateMany({
      where,
      data: { lastHeartbeatAt: new Date() },
    });
    // shouldFlushHeartbeatToDb is now a SET NX EX atomic claim — no separate
    // mark step needed; the key auto-expires after 30s.
  }

  // Trả lại trạng thái + hạn làm bài hiện tại (đọc theo khoá chính, rẻ):
  //   - durationSec: giảng viên gia hạn (extendAttempt) chỉ đổi DB; không có
  //     đường này thì đồng hồ trên máy thí sinh vẫn chạy về 0 theo hạn cũ và tự
  //     nộp bài giữa lúc được cho thêm giờ.
  //   - status: bài bị nộp/chấm ở nơi khác (giám thị buộc nộp, mở ở tab khác) thì
  //     máy này biết mà chuyển sang trang kết quả.
  //   - serverNow: để máy thí sinh chỉnh độ lệch đồng hồ liên tục, không chỉ một
  //     lần lúc tải trang.
  const cur = await prisma.examAttempt.findUnique({
    where: { id: params.id },
    select: { status: true, durationSec: true, userId: true, candidateId: true },
  });
  // Chỉ trả cho đúng chủ bài (nhánh cache ở trên không kiểm quyền sở hữu).
  const mine =
    cur !== null &&
    (subject.kind === "user"
      ? cur.userId === subject.userId
      : cur.candidateId === subject.candidateId);
  return NextResponse.json({
    ok: true,
    serverNow: new Date().toISOString(),
    ...(mine ? { status: cur.status, durationSec: cur.durationSec } : {}),
  });
}
