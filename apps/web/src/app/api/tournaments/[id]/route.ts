import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, prisma } from "@feedbackme/db";
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
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      startsAt: true,
      endsAt: true,
      teamSize: true,
      prizeXp: true,
      prizeDistribution: true,
      creatorId: true,
      course: { select: { slug: true, title: true } },
      missions: {
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          points: true,
          orderIndex: true,
          prerequisiteId: true,
        },
      },
      _count: { select: { registrations: true } },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ tournament });
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

const PatchInput = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(20_000).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    teamSize: z.number().int().positive().optional(),
    prizeXp: z.number().int().min(0).optional(),
    allowLateRegistration: z.boolean().optional(),
    prizeDistribution: z.record(z.unknown()).nullable().optional(),
    status: z.enum(["published"]).optional(), // only draft→published allowed here
  })
  .strict();

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tournament = await prisma.tournament.findUnique({
    where: { id: params.id },
    select: { id: true, creatorId: true, status: true, startsAt: true, endsAt: true },
  });
  if (!tournament) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const admin = await isAdmin(userId);
  if (!admin && tournament.creatorId !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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

  // Cannot change status if already published (or further)
  if (data.status === "published" && tournament.status !== "draft") {
    return NextResponse.json(
      { error: "validation_failed", details: "status_already_published" },
      { status: 400 },
    );
  }

  // Validate endsAt > startsAt using merged values
  const resolvedStartsAt = data.startsAt ? new Date(data.startsAt) : tournament.startsAt;
  const resolvedEndsAt = data.endsAt ? new Date(data.endsAt) : tournament.endsAt;
  if (resolvedEndsAt <= resolvedStartsAt) {
    return NextResponse.json(
      { error: "validation_failed", details: "endsAt_before_startsAt" },
      { status: 400 },
    );
  }

  const updated = await prisma.tournament.update({
    where: { id: params.id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.startsAt !== undefined && { startsAt: new Date(data.startsAt) }),
      ...(data.endsAt !== undefined && { endsAt: new Date(data.endsAt) }),
      ...(data.teamSize !== undefined && { teamSize: data.teamSize }),
      ...(data.prizeXp !== undefined && { prizeXp: data.prizeXp }),
      ...(data.allowLateRegistration !== undefined && {
        allowLateRegistration: data.allowLateRegistration,
      }),
      ...(data.prizeDistribution !== undefined && {
        prizeDistribution:
          data.prizeDistribution === null
            ? Prisma.DbNull
            : (data.prizeDistribution as Prisma.InputJsonValue),
      }),
      ...(data.status !== undefined && { status: data.status }),
    },
    select: { id: true, status: true },
  });

  return NextResponse.json({ tournament: updated });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  _req: Request,
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

  if (tournament.status !== "draft") {
    return NextResponse.json(
      { error: "validation_failed", details: "can_only_delete_draft" },
      { status: 400 },
    );
  }

  await prisma.tournament.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
