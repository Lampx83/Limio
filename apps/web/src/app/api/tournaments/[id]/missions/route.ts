import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
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

const PostInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(20_000),
  points: z.number().int().min(0).default(100),
  prerequisiteId: z.string().uuid().nullable().optional(),
}).merge(ConditionInput);

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tournament = await prisma.tournament.findUnique({
    where: { id: params.id },
    select: { id: true, creatorId: true, status: true },
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

  // skill_mastered_in_group requires conditionSkillCode.
  if (resolvedConditionType === "skill_mastered_in_group" && !parsed.data.conditionSkillCode) {
    return NextResponse.json(
      { error: "validation_failed", details: "conditionSkillCode_required_for_skill_group" },
      { status: 400 },
    );
  }

  const mission = await prisma.tournamentMission.create({
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
    },
    select: { id: true },
  });

  return NextResponse.json({ missionId: mission.id }, { status: 201 });
}
