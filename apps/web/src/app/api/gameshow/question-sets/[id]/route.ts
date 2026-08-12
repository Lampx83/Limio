import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { requireQuestionSetOwner } from "@/lib/gameshow/questionSetAuth";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  const check = await requireQuestionSetOwner(params.id, userId);
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });

  const items = await prisma.gameQuestionSetItem.findMany({
    where: { setId: params.id },
    orderBy: { orderIndex: "asc" },
    include: { options: { orderBy: { orderIndex: "asc" } } },
  });

  return Response.json({
    id: check.set.id,
    title: check.set.title,
    items: items.map((it) => ({
      id: it.id,
      type: it.type,
      prompt: it.prompt,
      timeLimitSec: it.timeLimitSec,
      orderIndex: it.orderIndex,
      options: it.options.map((o) => ({ id: o.id, label: o.label, isCorrect: o.isCorrect })),
    })),
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  const check = await requireQuestionSetOwner(params.id, userId);
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });

  const body = await req.json().catch(() => null);
  const parsed = z.object({ title: z.string().trim().min(1).max(200) }).safeParse(body);
  if (!parsed.success) return Response.json({ error: "validation_failed" }, { status: 400 });

  await prisma.gameQuestionSet.update({
    where: { id: params.id },
    data: { title: parsed.data.title },
  });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  const check = await requireQuestionSetOwner(params.id, userId);
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });

  // GameSession.questionSetId dùng onDelete: SetNull — phiên đã tạo không bị ảnh hưởng
  // vì câu hỏi đã snapshot vào GameSessionQuestion từ lúc tạo phiên.
  await prisma.gameQuestionSet.delete({ where: { id: params.id } });
  return Response.json({ ok: true });
}
