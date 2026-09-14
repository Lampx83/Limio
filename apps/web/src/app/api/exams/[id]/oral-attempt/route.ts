import { NextResponse } from "next/server";
import { MAX_ORAL_QUESTIONS } from "@feedbackme/core-feedback";
import { startOralExamAttempt } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { upsertOnStart } from "@/lib/exam-live-bus";

export const runtime = "nodejs";

/** A6.3 — Bắt đầu (hoặc resume) buổi vấn đáp AI. Chỉ hỗ trợ SV đã đăng nhập + đã ghi danh. */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await startOralExamAttempt(userId, params.id);
    // A6.5 — đăng ký vào dashboard giám thị realtime, cùng cơ chế thi viết
    // (exam-live-bus). Best-effort: dashboard không có thì SV vẫn thi bình
    // thường, chỉ là GV không thấy ngay — không chặn luồng thi vì việc này.
    try {
      const attempt = await prisma.examAttempt.findUnique({
        where: { id: r.attemptId },
        select: {
          id: true,
          userId: true,
          status: true,
          startedAt: true,
          submittedAt: true,
          resumeCount: true,
          user: { select: { displayName: true } },
          _count: {
            select: { incidents: { where: { type: { not: "network_lost" } } } },
          },
        },
      });
      if (attempt) {
        await upsertOnStart(params.id, {
          attemptId: attempt.id,
          userId: attempt.userId,
          userName: attempt.user?.displayName ?? null,
          subjectType: "user",
          status: attempt.status,
          startedAt: attempt.startedAt.getTime(),
          expiresAt: attempt.startedAt.getTime() + r.durationSec * 1000,
          submittedAt: attempt.submittedAt?.getTime() ?? null,
          answeredQuestionIds: [],
          totalQuestions: MAX_ORAL_QUESTIONS,
          incidentCount: attempt._count.incidents,
          lastSeenAt: Date.now(),
          resumeCount: attempt.resumeCount,
        });
      }
    } catch {
      // best-effort, xem comment ở trên
    }
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
