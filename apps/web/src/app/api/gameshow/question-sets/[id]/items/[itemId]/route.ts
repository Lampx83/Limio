import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { requireQuestionSetOwner } from "@/lib/gameshow/questionSetAuth";
import { QuestionItemInput } from "@/lib/gameshow/questionSetSchema";

export const runtime = "nodejs";

async function loadItem(setId: string, itemId: string) {
  const item = await prisma.gameQuestionSetItem.findUnique({ where: { id: itemId } });
  if (!item || item.setId !== setId) return null;
  return item;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; itemId: string } },
) {
  const userId = await requireUserId();
  const check = await requireQuestionSetOwner(params.id, userId);
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });

  const item = await loadItem(params.id, params.itemId);
  if (!item) return Response.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = QuestionItemInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.gameQuestionSetOption.deleteMany({ where: { itemId: item.id } }),
    prisma.gameQuestionSetItem.update({
      where: { id: item.id },
      data: {
        type: parsed.data.type,
        prompt: parsed.data.prompt,
        timeLimitSec: parsed.data.timeLimitSec,
        options: {
          create: parsed.data.options.map((o, i) => ({
            label: o.label,
            isCorrect: o.isCorrect,
            orderIndex: i,
          })),
        },
      },
    }),
    prisma.gameQuestionSet.update({
      where: { id: params.id },
      data: { updatedAt: new Date() },
    }),
  ]);

  return Response.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; itemId: string } },
) {
  const userId = await requireUserId();
  const check = await requireQuestionSetOwner(params.id, userId);
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });

  const item = await loadItem(params.id, params.itemId);
  if (!item) return Response.json({ error: "not_found" }, { status: 404 });

  await prisma.gameQuestionSetItem.delete({ where: { id: item.id } });
  await prisma.gameQuestionSet.update({
    where: { id: params.id },
    data: { updatedAt: new Date() },
  });

  return Response.json({ ok: true });
}
