import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { requireQuestionSetOwner } from "@/lib/gameshow/questionSetAuth";

export const runtime = "nodejs";

// Đổi chỗ với câu liền kề (lên/xuống) — đủ cho sắp xếp thủ công, không cần
// thư viện drag-and-drop.
export async function POST(
  req: Request,
  { params }: { params: { id: string; itemId: string } },
) {
  const userId = await requireUserId();
  const check = await requireQuestionSetOwner(params.id, userId);
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });

  const body = await req.json().catch(() => null);
  const parsed = z.object({ direction: z.enum(["up", "down"]) }).safeParse(body);
  if (!parsed.success) return Response.json({ error: "validation_failed" }, { status: 400 });

  const item = await prisma.gameQuestionSetItem.findUnique({ where: { id: params.itemId } });
  if (!item || item.setId !== params.id) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const neighbor = await prisma.gameQuestionSetItem.findFirst({
    where: {
      setId: params.id,
      orderIndex: parsed.data.direction === "up" ? { lt: item.orderIndex } : { gt: item.orderIndex },
    },
    orderBy: { orderIndex: parsed.data.direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return Response.json({ ok: true, noop: true });

  // Swap qua 1 orderIndex tạm để tránh đụng unique([setId, orderIndex]).
  await prisma.$transaction([
    prisma.gameQuestionSetItem.update({ where: { id: item.id }, data: { orderIndex: -1 } }),
    prisma.gameQuestionSetItem.update({
      where: { id: neighbor.id },
      data: { orderIndex: item.orderIndex },
    }),
    prisma.gameQuestionSetItem.update({
      where: { id: item.id },
      data: { orderIndex: neighbor.orderIndex },
    }),
  ]);

  return Response.json({ ok: true });
}
