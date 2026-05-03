import { NextResponse } from "next/server";
import { H5pError, recordH5pXapi } from "@feedbackme/core-lms";
import {
  awardSkillMasterBadges,
  onH5pCompleted,
} from "@feedbackme/core-gamification";
import { updateLearnerStateForLessonObservation } from "@feedbackme/core-feedback";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = ((await readJson(req)) ?? {}) as Record<string, unknown>;

  const verb = typeof body.verb === "string" ? body.verb : undefined;
  const scoreRaw =
    typeof body.scoreRaw === "number"
      ? body.scoreRaw
      : body.scoreRaw === null
        ? null
        : undefined;
  const scoreMax =
    typeof body.scoreMax === "number"
      ? body.scoreMax
      : body.scoreMax === null
        ? null
        : undefined;
  const success =
    typeof body.success === "boolean"
      ? body.success
      : body.success === null
        ? null
        : undefined;
  const state =
    typeof body.state === "object" && body.state !== null
      ? (body.state as Record<string, unknown>)
      : body.state === null
        ? null
        : undefined;

  try {
    await recordH5pXapi(userId, params.id, {
      verb,
      scoreRaw,
      scoreMax,
      success,
      state,
    });
  } catch (e) {
    if (e instanceof H5pError) {
      const status =
        e.code === "attempt_not_found"
          ? 404
          : e.code === "forbidden"
            ? 403
            : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }

  // Bridge: feed BKT + gamification when a meaningful xAPI verb arrives.
  // CLAUDE.md §4.3 — orchestration only here; core modules don't import each other.
  const attempt = await prisma.h5pAttempt.findUnique({
    where: { id: params.id },
    select: { courseId: true, lessonId: true, packageId: true, userId: true },
  });

  let bridge: {
    bktSkillsUpdated: number;
    newlyMasteredSkills: number;
    xpAwarded: number | null;
    skillBadges: number;
  } | null = null;

  if (attempt && attempt.userId === userId && attempt.lessonId) {
    let bktSkillsUpdated = 0;
    let newlyMasteredCount = 0;
    let skillBadgesAwarded = 0;

    // BKT — for "answered" or "completed" verbs with explicit success.
    if ((verb === "answered" || verb === "completed") && typeof success === "boolean") {
      const r = await updateLearnerStateForLessonObservation(
        userId,
        attempt.lessonId,
        success,
      );
      bktSkillsUpdated = r.skillsUpdated;
      newlyMasteredCount = r.newlyMastered.length;

      // D4 — auto skill-master badges for any newly-crossed skills.
      if (attempt.courseId && r.newlyMastered.length > 0) {
        const badges = await awardSkillMasterBadges({
          userId,
          courseId: attempt.courseId,
          skills: r.newlyMastered,
        });
        skillBadgesAwarded = badges.awarded.length;
      }
    }

    // Gamification — completion+success → XP + streak + quest.
    let xpAwarded: number | null = null;
    if (verb === "completed" && success === true && attempt.courseId) {
      const result = await onH5pCompleted({
        userId,
        courseId: attempt.courseId,
        packageId: attempt.packageId,
        attemptId: params.id,
        scoreRaw: scoreRaw ?? null,
        scoreMax: scoreMax ?? null,
      });
      xpAwarded = result.xp.amountGranted;
    }

    bridge = {
      bktSkillsUpdated,
      newlyMasteredSkills: newlyMasteredCount,
      xpAwarded,
      skillBadges: skillBadgesAwarded,
    };
  }

  return NextResponse.json({ ok: true, bridge });
}
