import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import { isMissionTeamCompatible } from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!tournament) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const missions = await prisma.tournamentMission.findMany({
    where: { tournamentId: params.id },
    orderBy: { orderIndex: "asc" },
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
      reviewQuorum: true,
      peerReviewCaptainsOnly: true,
      reviewWindowEndAt: true,
      rubric: true,
      contentPayload: true,
      autoCheckRule: true,
      isTeamSubmission: true,
    },
  });

  return NextResponse.json({ missions });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

// Condition sub-schema — all optional; validated together in refinements below.
const ConditionInput = z.object({
  templateId:         z.string().uuid().nullable().optional(),
  conditionType:      z.string().trim().min(1).max(100).nullable().optional(),
  conditionValue:     z.number().int().min(1).nullable().optional(),
  conditionScope:     z.enum(["course", "global"]).default("course"),
  conditionMinScore:  z.number().int().min(1).max(100).nullable().optional(),
  conditionSkillCode: z.string().trim().min(1).max(200).nullable().optional(),
});

// C5.x — custom mission fields. Required when missionType ≠ COURSE_LINKED.
const RubricCriterionSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(200),
  scale: z.enum(["1-5", "pass_fail"]),
  weight: z.number().min(0.01).max(100),
});

const CustomMissionInput = z.object({
  missionType: z.enum(["COURSE_LINKED", "CUSTOM", "EXTERNAL"]).default("COURSE_LINKED"),
  verifyMode: z.enum(["AUTO_GRADE", "AUTO_CHECK", "PEER_REVIEW", "MANUAL_REVIEW"]).nullable().optional(),
  submissionDeadline: z.string().datetime().nullable().optional(),
  contentPayload: z.unknown().nullable().optional(),
  autoCheckRule: z.unknown().nullable().optional(),
  rubric: z.array(RubricCriterionSchema).nullable().optional(),
  peerReviewerCount:  z.number().int().min(1).max(50).nullable().optional(),
  reviewQuorum:       z.number().int().min(1).max(50).nullable().optional(),
  peerReviewCaptainsOnly: z.boolean().optional().default(false),
  reviewWindowEndAt: z.string().datetime().nullable().optional(),
  passThreshold: z.number().min(0).max(1).nullable().optional(),
  isTeamSubmission: z.boolean().optional().default(false),
});

const PostInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(20_000),
  points: z.number().int().min(0).default(100),
  prerequisiteId: z.string().uuid().nullable().optional(),
}).merge(ConditionInput).merge(CustomMissionInput);

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tournament = await prisma.tournament.findUnique({
    where: { id: params.id },
    select: { id: true, creatorId: true, status: true, teamSize: true },
  });
  if (!tournament) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const admin = await isAdmin(userId);
  if (!admin && tournament.creatorId !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (tournament.status !== "draft" && tournament.status !== "published") {
    return NextResponse.json(
      { error: "validation_failed", details: "tournament_not_editable" },
      { status: 400 },
    );
  }

  const body = await readJson(req);
  const parsed = PostInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Validate prerequisite belongs to this tournament
  if (parsed.data.prerequisiteId) {
    const prereq = await prisma.tournamentMission.findFirst({
      where: { id: parsed.data.prerequisiteId, tournamentId: params.id },
      select: { id: true },
    });
    if (!prereq) {
      return NextResponse.json(
        { error: "validation_failed", details: "prerequisite_not_found" },
        { status: 400 },
      );
    }
  }

  // Auto-set orderIndex = current max + 1
  const aggregate = await prisma.tournamentMission.aggregate({
    where: { tournamentId: params.id },
    _max: { orderIndex: true },
  });
  const nextIndex = (aggregate._max.orderIndex ?? 0) + 1;

  // If templateId is provided, derive conditionType + defaults from the template.
  // Instructor-supplied values override template defaults when explicitly set.
  let resolvedConditionType = parsed.data.conditionType ?? null;
  let resolvedConditionValue = parsed.data.conditionValue ?? null;
  let resolvedMinScore = parsed.data.conditionMinScore ?? null;

  if (parsed.data.templateId) {
    const tmpl = await prisma.missionTemplate.findUnique({
      where: { id: parsed.data.templateId },
      select: { conditionType: true, defaultValue: true, defaultMinScore: true },
    });
    if (!tmpl) {
      return NextResponse.json(
        { error: "validation_failed", details: "template_not_found" },
        { status: 400 },
      );
    }
    resolvedConditionType  = resolvedConditionType  ?? tmpl.conditionType;
    resolvedConditionValue = resolvedConditionValue ?? tmpl.defaultValue;
    resolvedMinScore       = resolvedMinScore       ?? tmpl.defaultMinScore ?? null;
  }

  // Team tournaments cannot use individual-state condition types (streak,
  // misconception, skill mastery) — SUM rule would produce meaningless totals.
  if (!isMissionTeamCompatible(resolvedConditionType, tournament.teamSize)) {
    return NextResponse.json(
      { error: "mission_not_team_compatible", details: resolvedConditionType },
      { status: 400 },
    );
  }

  // COLLECTIVE submission only valid for team + non-AUTO_GRADE custom missions.
  if (parsed.data.isTeamSubmission) {
    if (tournament.teamSize <= 1) {
      return NextResponse.json(
        { error: "validation_failed", details: "team_submission_requires_team_tournament" },
        { status: 400 },
      );
    }
    const vm = parsed.data.verifyMode;
    if (vm === "AUTO_GRADE" || !vm) {
      return NextResponse.json(
        { error: "validation_failed", details: "team_submission_incompatible_verify_mode" },
        { status: 400 },
      );
    }
  }

  // skill_mastered_in_group requires conditionSkillCode.
  if (resolvedConditionType === "skill_mastered_in_group" && !parsed.data.conditionSkillCode) {
    return NextResponse.json(
      { error: "validation_failed", details: "conditionSkillCode_required_for_skill_group" },
      { status: 400 },
    );
  }

  // C5.x — custom mission validations.
  const { missionType, verifyMode } = parsed.data;
  if (missionType !== "COURSE_LINKED") {
    if (!verifyMode) {
      return NextResponse.json(
        { error: "validation_failed", details: "verifyMode_required_when_not_course_linked" },
        { status: 400 },
      );
    }
    if (!parsed.data.submissionDeadline) {
      return NextResponse.json(
        { error: "validation_failed", details: "submissionDeadline_required" },
        { status: 400 },
      );
    }
  }
  if (missionType === "EXTERNAL" && verifyMode && !["AUTO_CHECK", "MANUAL_REVIEW"].includes(verifyMode)) {
    return NextResponse.json(
      { error: "validation_failed", details: "external_requires_auto_check_or_manual" },
      { status: 400 },
    );
  }
  if (verifyMode === "PEER_REVIEW") {
    if (!parsed.data.rubric || parsed.data.rubric.length === 0) {
      return NextResponse.json(
        { error: "validation_failed", details: "rubric_required_for_peer_review" },
        { status: 400 },
      );
    }
    if (parsed.data.passThreshold === null || parsed.data.passThreshold === undefined) {
      return NextResponse.json(
        { error: "validation_failed", details: "passThreshold_required_for_peer_review" },
        { status: 400 },
      );
    }
    if (!parsed.data.reviewWindowEndAt) {
      return NextResponse.json(
        { error: "validation_failed", details: "reviewWindowEndAt_required_for_peer_review" },
        { status: 400 },
      );
    }
  }
  if (verifyMode === "AUTO_CHECK" && !parsed.data.autoCheckRule) {
    return NextResponse.json(
      { error: "validation_failed", details: "autoCheckRule_required" },
      { status: 400 },
    );
  }
  if (verifyMode === "MANUAL_REVIEW" && (parsed.data.passThreshold === null || parsed.data.passThreshold === undefined)) {
    return NextResponse.json(
      { error: "validation_failed", details: "passThreshold_required_for_manual_review" },
      { status: 400 },
    );
  }

  // Create mission + backing entities (Quiz for AUTO_GRADE, Assignment for
  // MANUAL_REVIEW) in a single transaction.
  const mission = await prisma.$transaction(async (tx) => {
    const m = await tx.tournamentMission.create({
      data: {
        tournamentId:       params.id,
        title:              parsed.data.title,
        description:        parsed.data.description,
        points:             parsed.data.points,
        prerequisiteId:     parsed.data.prerequisiteId ?? null,
        orderIndex:         nextIndex,
        templateId:         parsed.data.templateId         ?? null,
        conditionType:      resolvedConditionType,
        conditionValue:     resolvedConditionValue,
        conditionScope:     parsed.data.conditionScope,
        conditionMinScore:  resolvedMinScore,
        conditionSkillCode: parsed.data.conditionSkillCode ?? null,
        missionType,
        verifyMode:         verifyMode ?? null,
        submissionDeadline: parsed.data.submissionDeadline ? new Date(parsed.data.submissionDeadline) : null,
        contentPayload:     (parsed.data.contentPayload ?? null) as never,
        autoCheckRule:      (parsed.data.autoCheckRule ?? null) as never,
        rubric:             (parsed.data.rubric ?? null) as never,
        peerReviewerCount:  parsed.data.peerReviewerCount ?? (verifyMode === "PEER_REVIEW" ? 3 : null),
        reviewQuorum:       parsed.data.reviewQuorum ?? null,
        peerReviewCaptainsOnly: parsed.data.peerReviewCaptainsOnly,
        reviewWindowEndAt:  parsed.data.reviewWindowEndAt ? new Date(parsed.data.reviewWindowEndAt) : null,
        passThreshold:      parsed.data.passThreshold ?? null,
        isTeamSubmission:   parsed.data.isTeamSubmission,
      },
      select: { id: true },
    });

    // AUTO_GRADE — create hidden Quiz linked to this mission. Instructor adds
    // questions afterwards via the standard Quiz editor (filtered to show only
    // this quiz in mission context).
    if (verifyMode === "AUTO_GRADE") {
      await tx.quiz.create({
        data: {
          title: parsed.data.title,
          description: "Tournament mission quiz",
          isHidden: true,
          tournamentMissionId: m.id,
          passThresholdPct: Math.round((parsed.data.passThreshold ?? 0.7) * 100),
        },
      });
    }
    // MANUAL_REVIEW — create hidden Assignment linked to this mission. Reuses
    // the instructor grading UI (filtered by tournamentMissionId).
    if (verifyMode === "MANUAL_REVIEW") {
      await tx.assignment.create({
        data: {
          title: parsed.data.title,
          description: parsed.data.description,
          isHidden: true,
          tournamentMissionId: m.id,
          dueAt: parsed.data.submissionDeadline ? new Date(parsed.data.submissionDeadline) : null,
        },
      });
    }
    return m;
  });

  return NextResponse.json({ missionId: mission.id }, { status: 201 });
}
