import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── PATCH ────────────────────────────────────────────────────────────────────

const RubricCriterionSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(200),
  scale: z.enum(["1-5", "pass_fail"]),
  weight: z.number().min(0.01).max(100),
});

const PatchInput = z
  .object({
    title:              z.string().trim().min(1).max(200).optional(),
    description:        z.string().trim().min(1).max(20_000).optional(),
    points:             z.number().int().min(0).optional(),
    prerequisiteId:     z.string().uuid().nullable().optional(),
    // C5 condition fields — all optional in PATCH.
    conditionType:      z.string().trim().min(1).max(100).nullable().optional(),
    conditionValue:     z.number().int().min(1).nullable().optional(),
    conditionScope:     z.enum(["course", "global"]).optional(),
    conditionMinScore:  z.number().int().min(1).max(100).nullable().optional(),
    conditionSkillCode: z.string().trim().min(1).max(200).nullable().optional(),
    // C5.x custom-mission fields. missionType & verifyMode are immutable after
    // creation (changing them would orphan backing Quiz/Assignment), so they are
    // intentionally NOT accepted here — only the content/config is editable.
    submissionDeadline: z.string().datetime().nullable().optional(),
    contentPayload:     z.unknown().nullable().optional(),
    autoCheckRule:      z.unknown().nullable().optional(),
    rubric:             z.array(RubricCriterionSchema).nullable().optional(),
    peerReviewerCount:  z.number().int().min(1).max(50).nullable().optional(),
    peerReviewCaptainsOnly: z.boolean().optional(),
    reviewWindowEndAt:  z.string().datetime().nullable().optional(),
    passThreshold:      z.number().min(0).max(1).nullable().optional(),
    isTeamSubmission:   z.boolean().optional(),
  })
  .strict();

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const mission = await prisma.tournamentMission.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      tournamentId: true,
      conditionType: true,
      conditionSkillCode: true,
      missionType: true,
      verifyMode: true,
      reviewWindowEndAt: true,
      tournament: { select: { creatorId: true, status: true, teamSize: true } },
      assignment: { select: { id: true } },
    },
  });
  if (!mission) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const admin = await isAdmin(userId);
  if (!admin && mission.tournament.creatorId !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (mission.tournament.status === "ended") {
    return NextResponse.json(
      { error: "validation_failed", details: "tournament_already_ended" },
      { status: 400 },
    );
  }

  const body = await readJson(req);
  const parsed = PatchInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Validate prerequisite belongs to the same tournament and is not self-referential
  if (data.prerequisiteId) {
    if (data.prerequisiteId === params.id) {
      return NextResponse.json(
        { error: "validation_failed", details: "prerequisite_cannot_be_self" },
        { status: 400 },
      );
    }
    const prereq = await prisma.tournamentMission.findFirst({
      where: { id: data.prerequisiteId, tournamentId: mission.tournamentId },
      select: { id: true },
    });
    if (!prereq) {
      return NextResponse.json(
        { error: "validation_failed", details: "prerequisite_not_found" },
        { status: 400 },
      );
    }
  }

  // Guard: skill_mastered_in_group must have conditionSkillCode set (either already
  // on the row or provided in this PATCH).
  const incomingConditionType = data.conditionType !== undefined
    ? data.conditionType
    : mission.conditionType;
  const incomingSkillCode = data.conditionSkillCode !== undefined
    ? data.conditionSkillCode
    : mission.conditionSkillCode;
  if (incomingConditionType === "skill_mastered_in_group" && !incomingSkillCode) {
    return NextResponse.json(
      { error: "validation_failed", details: "conditionSkillCode_required_for_skill_group" },
      { status: 400 },
    );
  }

  // ── C5.x — custom-mission field validations (verifyMode is immutable) ──
  const vm = mission.verifyMode;

  // submissionDeadline must stay set for custom/external missions.
  if (
    mission.missionType !== "COURSE_LINKED" &&
    data.submissionDeadline === null
  ) {
    return NextResponse.json(
      { error: "validation_failed", details: "submissionDeadline_required" },
      { status: 400 },
    );
  }

  // PEER_REVIEW: rubric / passThreshold / reviewWindowEndAt must not be cleared.
  if (vm === "PEER_REVIEW") {
    if (data.rubric !== undefined && (data.rubric === null || data.rubric.length === 0)) {
      return NextResponse.json(
        { error: "validation_failed", details: "rubric_required_for_peer_review" },
        { status: 400 },
      );
    }
    if (data.passThreshold === null) {
      return NextResponse.json(
        { error: "validation_failed", details: "passThreshold_required_for_peer_review" },
        { status: 400 },
      );
    }
    if (data.reviewWindowEndAt === null) {
      return NextResponse.json(
        { error: "validation_failed", details: "reviewWindowEndAt_required_for_peer_review" },
        { status: 400 },
      );
    }
  }

  // MANUAL_REVIEW: passThreshold must not be cleared.
  if (vm === "MANUAL_REVIEW" && data.passThreshold === null) {
    return NextResponse.json(
      { error: "validation_failed", details: "passThreshold_required_for_manual_review" },
      { status: 400 },
    );
  }

  // AUTO_CHECK: autoCheckRule must not be cleared.
  if (vm === "AUTO_CHECK" && data.autoCheckRule === null) {
    return NextResponse.json(
      { error: "validation_failed", details: "autoCheckRule_required" },
      { status: 400 },
    );
  }

  // Team submission only valid for team tournaments + non-quiz verify modes.
  if (data.isTeamSubmission === true) {
    if (mission.tournament.teamSize <= 1) {
      return NextResponse.json(
        { error: "validation_failed", details: "team_submission_requires_team_tournament" },
        { status: 400 },
      );
    }
    if (!vm || vm === "AUTO_GRADE") {
      return NextResponse.json(
        { error: "validation_failed", details: "team_submission_incompatible_verify_mode" },
        { status: 400 },
      );
    }
  }

  // Mở lại vòng chấm: reviewWindowEndAt cũ đã ở quá khứ, nay đặt sang tương lai.
  const nowMs = Date.now();
  const reopeningWindow =
    data.reviewWindowEndAt != null &&
    new Date(data.reviewWindowEndAt).getTime() > nowMs &&
    mission.reviewWindowEndAt != null &&
    mission.reviewWindowEndAt.getTime() <= nowMs;

  const updated = await prisma.$transaction(async (tx) => {
    const m = await tx.tournamentMission.update({
      where: { id: params.id },
      data: {
        ...(data.title              !== undefined && { title:              data.title }),
        ...(data.description        !== undefined && { description:        data.description }),
        ...(data.points             !== undefined && { points:             data.points }),
        ...(data.prerequisiteId     !== undefined && { prerequisiteId:     data.prerequisiteId }),
        ...(data.conditionType      !== undefined && { conditionType:      data.conditionType }),
        ...(data.conditionValue     !== undefined && { conditionValue:     data.conditionValue }),
        ...(data.conditionScope     !== undefined && { conditionScope:     data.conditionScope }),
        ...(data.conditionMinScore  !== undefined && { conditionMinScore:  data.conditionMinScore }),
        ...(data.conditionSkillCode !== undefined && { conditionSkillCode: data.conditionSkillCode }),
        // C5.x custom fields
        ...(data.submissionDeadline !== undefined && { submissionDeadline: data.submissionDeadline ? new Date(data.submissionDeadline) : null }),
        ...(data.contentPayload     !== undefined && { contentPayload:     (data.contentPayload ?? null) as never }),
        ...(data.autoCheckRule      !== undefined && { autoCheckRule:      (data.autoCheckRule ?? null) as never }),
        ...(data.rubric             !== undefined && { rubric:             (data.rubric ?? null) as never }),
        ...(data.peerReviewerCount  !== undefined && { peerReviewerCount:  data.peerReviewerCount }),
        ...(data.peerReviewCaptainsOnly !== undefined && { peerReviewCaptainsOnly: data.peerReviewCaptainsOnly }),
        ...(data.reviewWindowEndAt  !== undefined && { reviewWindowEndAt:  data.reviewWindowEndAt ? new Date(data.reviewWindowEndAt) : null }),
        // Mở lại window đã đóng (đẩy reviewWindowEndAt từ quá khứ ra tương lai)
        // → reset budget auto-gia-hạn để đợt bài mới không rơi thẳng fallback.
        ...(reopeningWindow && { reviewExtendCount: 0 }),
        ...(data.passThreshold      !== undefined && { passThreshold:      data.passThreshold }),
        ...(data.isTeamSubmission   !== undefined && { isTeamSubmission:   data.isTeamSubmission }),
      },
      select: {
        id: true,
        title: true,
        description: true,
        points: true,
        orderIndex: true,
        prerequisiteId: true,
        conditionType: true,
        conditionValue: true,
        conditionScope: true,
        conditionMinScore: true,
        conditionSkillCode: true,
        missionType: true,
        verifyMode: true,
        submissionDeadline: true,
        passThreshold: true,
        peerReviewerCount: true,
        peerReviewCaptainsOnly: true,
        reviewWindowEndAt: true,
        rubric: true,
        contentPayload: true,
        autoCheckRule: true,
        isTeamSubmission: true,
      },
    });

    // Keep the backing hidden Assignment (MANUAL_REVIEW) in sync so the
    // instructor grading queue shows the updated title/description/deadline.
    if (mission.verifyMode === "MANUAL_REVIEW" && mission.assignment) {
      await tx.assignment.update({
        where: { id: mission.assignment.id },
        data: {
          ...(data.title       !== undefined && { title:       data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.submissionDeadline !== undefined && { dueAt: data.submissionDeadline ? new Date(data.submissionDeadline) : null }),
        },
      });
    }

    return m;
  });

  return NextResponse.json({ mission: updated });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const mission = await prisma.tournamentMission.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      tournamentId: true,
      tournament: { select: { creatorId: true, status: true } },
    },
  });
  if (!mission) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const admin = await isAdmin(userId);
  if (!admin && mission.tournament.creatorId !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (mission.tournament.status !== "draft") {
    return NextResponse.json(
      { error: "validation_failed", details: "can_only_delete_from_draft_tournament" },
      { status: 400 },
    );
  }

  await prisma.tournamentMission.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
