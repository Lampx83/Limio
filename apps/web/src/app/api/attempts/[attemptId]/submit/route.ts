import { NextResponse } from "next/server";
import { submitAttempt } from "@feedbackme/core-lms";
import {
  awardSkillMasterBadges,
  onMisconceptionResolved,
  onQuizSubmitted,
} from "@feedbackme/core-gamification";
import {
  detectAndMarkResolved,
  generateDiagnosticFeedback,
  getMasterySnapshotForAttempt,
  getAverageMasteryForQuiz,
  recordMisconceptionsFromAttempt,
  updateLearnerStateFromAttempt,
} from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { dispatchPostQuizEmails } from "@/lib/gamificationEmails";

function getBaseUrl(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "";
}

export async function POST(
  req: Request,
  { params }: { params: { attemptId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = await submitAttempt(userId, params.attemptId);

    // D3 — read avgMastery BEFORE BKT update so the multiplier reflects what
    // the learner knew going in (not the post-quiz boost). Null on cold start
    // → onQuizSubmitted defaults to multiplier 1.0.
    const avgMastery = await getAverageMasteryForQuiz(userId, result.quizId);

    // Gamification: XP (with D3 adaptive multiplier) + first_win/perfect_score
    // badges + streak.
    let gamification: Awaited<ReturnType<typeof onQuizSubmitted>> | null = null;
    if (result.courseId) {
      gamification = await onQuizSubmitted({
        userId,
        courseId: result.courseId,
        attemptId: result.attemptId,
        quizId: result.quizId,
        difficulty: result.difficulty,
        isFirstPass: result.isFirstPass,
        elapsedSec: result.elapsedSec,
        scorePct: result.scorePct,
        avgMastery,
      });
    }

    // B9 — snapshot mastery before anything scores this attempt, so the
    // feedback rows can record what the system believed when they were chosen.
    // Read here rather than inside generation, which runs alongside the BKT
    // update below and would race it.
    const masterySnapshot = await getMasterySnapshotForAttempt(
      userId,
      result.attemptId,
    );

    // Phase 2 Feedback Engine in parallel.
    const [feedback, detectedMc, bkt] = await Promise.all([
      generateDiagnosticFeedback(userId, result.attemptId, undefined, {
        masterySnapshot,
      }),
      recordMisconceptionsFromAttempt(userId, result.attemptId),
      updateLearnerStateFromAttempt(userId, result.attemptId),
    ]);

    // B2.5 — resolve any flags whose underlying misconception was avoided in
    // this attempt. Run AFTER detection so a same-attempt wrong+correct on the
    // same misconception doesn't self-resolve (excludeMisconceptionIds).
    const cleared = await detectAndMarkResolved(userId, result.attemptId, {
      excludeMisconceptionIds: detectedMc.detected,
    });

    // D1 — bridge: feedback emits misconception.resolved → gamification awards XP.
    // Lifetime-once per (user, misconceptionId) via awardXp idempotency.
    const resolvedXpAwards: Array<{
      misconceptionId: string;
      xp: Awaited<ReturnType<typeof onMisconceptionResolved>>["xp"];
    }> = [];
    if (result.courseId) {
      for (const misconceptionId of cleared.resolved) {
        const r = await onMisconceptionResolved({
          userId,
          courseId: result.courseId,
          misconceptionId,
          attemptId: result.attemptId,
        });
        resolvedXpAwards.push({ misconceptionId, xp: r.xp });
      }
    }

    // D4 — auto-award skill master badge(s) for any skills that just crossed
    // the mastery threshold. Auto-creates Badge rows on first occurrence.
    let skillBadges: Awaited<ReturnType<typeof awardSkillMasterBadges>> | null = null;
    if (result.courseId && bkt.newlyMastered.length > 0) {
      skillBadges = await awardSkillMasterBadges({
        userId,
        courseId: result.courseId,
        skills: bkt.newlyMastered,
      });
    }

    // Best-effort post-quiz emails (level-up + new badges). Never blocks
    // the response — uses admin-editable templates.
    if (result.courseId) {
      const newBadges = [
        ...(gamification?.badges.awarded ?? []),
        ...(skillBadges?.awarded ?? []),
      ];
      const leveledUpTo =
        gamification?.xp?.leveledUp && gamification.xp.amountGranted >= 0
          ? {
              level: gamification.xp.after.level,
              totalXp: gamification.xp.after.xp,
            }
          : undefined;
      void dispatchPostQuizEmails({
        userId,
        courseId: result.courseId,
        leveledUpTo,
        newBadges,
        baseUrl: getBaseUrl(req),
      });
    }

    return NextResponse.json({
      ...result,
      gamification,
      feedback,
      skillBadges,
      newlyMasteredSkills: bkt.newlyMastered,
      misconceptionsResolved: cleared.resolved,
      resolvedXpAwards,
    });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
