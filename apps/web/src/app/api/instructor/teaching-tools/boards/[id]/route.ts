import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

async function authorizeOwner(boardId: string, userId: string) {
  const board = await prisma.interactiveBoard.findUnique({
    where: { id: boardId },
    select: { id: true, ownerId: true },
  });
  if (!board) return { error: "not_found" as const };
  if (board.ownerId !== userId) return { error: "forbidden" as const };
  return { board };
}

// GET — host view: board + notes (ẩn cả note hidden cho owner)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const auth1 = await authorizeOwner(params.id, session.user.id);
  if ("error" in auth1) {
    return Response.json(
      { error: auth1.error },
      { status: auth1.error === "not_found" ? 404 : 403 },
    );
  }

  const board = await prisma.interactiveBoard.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      code: true,
      title: true,
      prompt: true,
      status: true,
      createdAt: true,
      closedAt: true,
      notes: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          authorName: true,
          content: true,
          color: true,
          hidden: true,
          createdAt: true,
        },
      },
    },
  });
  return Response.json(board);
}

// PATCH — close/reopen board
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const auth1 = await authorizeOwner(params.id, session.user.id);
  if ("error" in auth1) {
    return Response.json(
      { error: auth1.error },
      { status: auth1.error === "not_found" ? 404 : 403 },
    );
  }

  try {
    const body = await req.json();
    const { status } = z.object({ status: z.enum(["open", "closed"]) }).parse(body);
    const updated = await prisma.interactiveBoard.update({
      where: { id: params.id },
      data: {
        status,
        closedAt: status === "closed" ? new Date() : null,
      },
      select: { id: true, status: true, closedAt: true },
    });
    return Response.json(updated);
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}

// DELETE — xóa board (cascade xóa notes)
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const auth1 = await authorizeOwner(params.id, session.user.id);
  if ("error" in auth1) {
    return Response.json(
      { error: auth1.error },
      { status: auth1.error === "not_found" ? 404 : 403 },
    );
  }
  await prisma.interactiveBoard.delete({ where: { id: params.id } });
  return Response.json({ ok: true });
}
