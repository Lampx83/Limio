import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { requireQuestionSetOwner } from "@/lib/gameshow/questionSetAuth";
import { QuestionItemInput } from "@/lib/gameshow/questionSetSchema";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  const check = await requireQuestionSetOwner(params.id, userId);
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });

  const body = await req.json().catch(() => null);
  const parsed = QuestionItemInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const last = await prisma.gameQuestionSetItem.findFirst({
    where: { setId: params.id },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });
  const orderIndex = (last?.orderIndex ?? -1) + 1;

  const item = await prisma.gameQuestionSetItem.create({
    data: {
      setId: params.id,
      orderIndex,
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
    include: { options: { orderBy: { orderIndex: "asc" } } },
  });

  await prisma.gameQuestionSet.update({
    where: { id: params.id },
    data: { updatedAt: new Date() },
  });

  return Response.json({
    id: item.id,
    type: item.type,
    prompt: item.prompt,
    timeLimitSec: item.timeLimitSec,
    orderIndex: item.orderIndex,
    options: item.options.map((o) => ({ id: o.id, label: o.label, isCorrect: o.isCorrect })),
  });
}
