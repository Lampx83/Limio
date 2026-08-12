import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const sets = await prisma.gameQuestionSet.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      _count: { select: { items: true } },
    },
  });

  return Response.json({
    sets: sets.map((s) => ({
      id: s.id,
      title: s.title,
      updatedAt: s.updatedAt.toISOString(),
      questionCount: s._count.items,
    })),
  });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = z.object({ title: z.string().trim().min(1).max(200) }).safeParse(body);
  if (!parsed.success) return Response.json({ error: "validation_failed" }, { status: 400 });

  const set = await prisma.gameQuestionSet.create({
    data: { ownerId: userId, title: parsed.data.title },
  });

  return Response.json({ id: set.id, title: set.title });
}
