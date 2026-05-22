import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

async function assertOwnerOrAdmin(tournamentId: string, userId: string) {
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { creatorId: true },
  });
  if (!t) return { ok: false as const, status: 404, code: "tournament_not_found" };
  if (t.creatorId !== userId && !(await isAdmin(userId))) {
    return { ok: false as const, status: 403, code: "forbidden" };
  }
  return { ok: true as const };
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const guard = await assertOwnerOrAdmin(params.id, userId);
  if (!guard.ok) return NextResponse.json({ error: guard.code }, { status: guard.status });

  const judges = await prisma.tournamentJudge.findMany({
    where: { tournamentId: params.id },
    orderBy: { addedAt: "asc" },
    include: { user: { select: { id: true, displayName: true, email: true } } },
  });
  return NextResponse.json({ judges });
}

const PostInput = z.object({
  email: z.string().trim().email(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const guard = await assertOwnerOrAdmin(params.id, userId);
  if (!guard.ok) return NextResponse.json({ error: guard.code }, { status: guard.status });

  const parsed = PostInput.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { id: true, displayName: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  try {
    await prisma.tournamentJudge.create({
      data: { tournamentId: params.id, userId: user.id },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "already_judge" }, { status: 409 });
    }
    throw e;
  }
  return NextResponse.json({ ok: true, user });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const guard = await assertOwnerOrAdmin(params.id, userId);
  if (!guard.ok) return NextResponse.json({ error: guard.code }, { status: guard.status });

  const url = new URL(req.url);
  const judgeUserId = url.searchParams.get("userId");
  if (!judgeUserId) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  await prisma.tournamentJudge.deleteMany({
    where: { tournamentId: params.id, userId: judgeUserId },
  });
  return NextResponse.json({ ok: true });
}
