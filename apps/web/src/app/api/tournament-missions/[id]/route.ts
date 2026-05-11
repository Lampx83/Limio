import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── PATCH ────────────────────────────────────────────────────────────────────

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
      tournament: { select: { creatorId: true, status: true } },
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

  const updated = await prisma.tournamentMission.update({
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
    },
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
