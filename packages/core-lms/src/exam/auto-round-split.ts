import { prisma, type PrismaClient } from "@feedbackme/db";
import { sessionOpenState } from "./session-window";

/**
 * Tách "Đợt thi tự động" (AUTO-EXAM-…) — dọn dữ liệu cũ sau khi buổi đơn không
 * còn thuộc đợt (bước 2 của kế hoạch đợt/ca).
 *
 * Quy tắc cho từng ca nằm trong đợt tự động:
 *  - buổi đơn (scale = simple: link nhanh, thử nghiệm, vấn đáp)  → gỡ khỏi đợt
 *    (roundId = null). Lượt làm và phòng giữ nguyên.
 *  - kỳ thi (scale = formal) ĐÃ CÓ lượt làm                      → giữ, và đợt được
 *    đổi thành đợt chính thức đặt tên theo đề.
 *  - kỳ thi CHƯA có lượt làm, không có thí sinh, không đang mở   → xoá ca (+ phòng).
 *  - kỳ thi chưa có lượt làm nhưng đang mở theo lịch             → ĐÓNG (giữ ca, giữ
 *    dữ liệu). Publish cũ dựng ca kéo tới năm sau; để mở thì học viên vẫn vào được.
 *  - kỳ thi chưa có lượt làm nhưng CÓ thí sinh                   → bỏ qua, báo cáo.
 *    Thí sinh là danh sách người ta đã nhập; xoá tự động là mất dữ liệu.
 *
 * Đợt tự động không còn ca nào sau khi xử lý thì bị xoá.
 * Chạy dry-run trước (planAutoRoundSplit), rồi mới applyAutoRoundSplit.
 * Không ghi LearningEvent (đây là dọn dữ liệu, không phải hành vi nghiệp vụ).
 */

export type AutoRoundSplitPlan = {
  /** Ca buổi đơn cần gỡ khỏi đợt. */
  detachSessionIds: string[];
  /** Ca kỳ thi chưa ai làm, không có thí sinh, không mở — xoá. */
  deleteSessionIds: string[];
  /** Ca theo lịch đang mở, chưa ai làm — đóng bằng cách đặt closesAt = now. */
  closeScheduledIds: string[];
  /** Ca thủ công đang mở, chưa ai làm — đóng bằng cách đặt status = closed. */
  closeManualIds: string[];
  /** Ca bị bỏ qua, kèm lý do. */
  skipped: { sessionId: string; roundId: string; reason: "has_candidates" }[];
  /** Đợt được đổi thành đợt chính thức (còn ca kỳ thi giữ lại). */
  renameRounds: { roundId: string; code: string; title: string }[];
  /** Đợt tự động không còn ca nào — xoá. */
  deleteRoundIds: string[];
};

type Db = Pick<PrismaClient, "examRound" | "examSession" | "examAttempt" | "examCandidate" | "exam" | "$transaction">;

export async function planAutoRoundSplit(
  db: Db = prisma,
  now: Date = new Date(),
): Promise<AutoRoundSplitPlan> {
  const rounds = await db.examRound.findMany({
    where: { code: { startsWith: "AUTO-EXAM-" } },
    select: {
      id: true,
      sessions: {
        select: {
          id: true,
          examId: true,
          scale: true,
          timingMode: true,
          status: true,
          opensAt: true,
          closesAt: true,
        },
      },
    },
  });

  const sessionIds = rounds.flatMap((r) => r.sessions.map((s) => s.id));
  const attempts = sessionIds.length
    ? await db.examAttempt.groupBy({
        by: ["sessionId"],
        where: { sessionId: { in: sessionIds } },
        _count: { _all: true },
      })
    : [];
  const candidates = sessionIds.length
    ? await db.examCandidate.groupBy({
        by: ["sessionId"],
        where: { sessionId: { in: sessionIds } },
        _count: { _all: true },
      })
    : [];
  const attemptCount = new Map(attempts.map((a) => [a.sessionId, a._count._all]));
  const candidateCount = new Map(candidates.map((c) => [c.sessionId, c._count._all]));

  const examIds = [...new Set(rounds.flatMap((r) => r.sessions.map((s) => s.examId)))];
  const exams = examIds.length
    ? await db.exam.findMany({ where: { id: { in: examIds } }, select: { id: true, title: true } })
    : [];
  const titleOf = new Map(exams.map((e) => [e.id, e.title]));

  const plan: AutoRoundSplitPlan = {
    detachSessionIds: [],
    deleteSessionIds: [],
    closeScheduledIds: [],
    closeManualIds: [],
    skipped: [],
    renameRounds: [],
    deleteRoundIds: [],
  };

  for (const r of rounds) {
    let kept = 0;
    let blocked = 0;
    let keptExam: { examId: string } | undefined;
    for (const s of r.sessions) {
      if (s.scale === "simple") {
        plan.detachSessionIds.push(s.id);
        continue;
      }
      // Kỳ thi (formal)
      if ((attemptCount.get(s.id) ?? 0) > 0) {
        kept++;
        keptExam ??= { examId: s.examId };
        continue;
      }
      // Chưa ai làm: đang mở → đóng (giữ ca); có thí sinh → bỏ qua; còn lại → xoá.
      if (sessionOpenState(s, now) === "open") {
        if (s.timingMode === "manual") plan.closeManualIds.push(s.id);
        else plan.closeScheduledIds.push(s.id);
        blocked++;
        continue;
      }
      if ((candidateCount.get(s.id) ?? 0) > 0) {
        plan.skipped.push({ sessionId: s.id, roundId: r.id, reason: "has_candidates" });
        blocked++;
        continue;
      }
      plan.deleteSessionIds.push(s.id);
    }
    if (kept > 0 && keptExam) {
      // Còn kỳ thi có lượt làm → đợt thành đợt chính thức theo tên đề.
      plan.renameRounds.push({
        roundId: r.id,
        code: `EXAM-${keptExam.examId.slice(0, 8).toUpperCase()}-${r.id.slice(0, 4).toUpperCase()}`,
        title: titleOf.get(keptExam.examId) ?? "Kỳ thi",
      });
    } else if (kept === 0 && blocked === 0) {
      // Không còn ca nào sau khi gỡ/xoá → đợt rỗng, xoá.
      plan.deleteRoundIds.push(r.id);
    }
    // Còn ca bị bỏ qua (blocked) mà không có kỳ thi nào có lượt: giữ đợt, báo cáo.
  }
  return plan;
}

export async function applyAutoRoundSplit(
  plan: AutoRoundSplitPlan,
  db: Db = prisma,
  now: Date = new Date(),
): Promise<void> {
  await db.$transaction(async (tx) => {
    if (plan.detachSessionIds.length)
      await tx.examSession.updateMany({
        where: { id: { in: plan.detachSessionIds } },
        data: { roundId: null },
      });
    if (plan.closeScheduledIds.length)
      await tx.examSession.updateMany({
        where: { id: { in: plan.closeScheduledIds } },
        data: { closesAt: now },
      });
    if (plan.closeManualIds.length)
      await tx.examSession.updateMany({
        where: { id: { in: plan.closeManualIds } },
        data: { status: "closed", closedAt: now },
      });
    if (plan.deleteSessionIds.length)
      await tx.examSession.deleteMany({ where: { id: { in: plan.deleteSessionIds } } });
    for (const r of plan.renameRounds)
      await tx.examRound.update({
        where: { id: r.roundId },
        data: { code: r.code, title: r.title },
      });
    if (plan.deleteRoundIds.length)
      await tx.examRound.deleteMany({ where: { id: { in: plan.deleteRoundIds } } });
  });
}
