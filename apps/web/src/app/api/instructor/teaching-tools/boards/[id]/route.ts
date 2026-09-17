import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { normalizeBoardColumns } from "@/lib/board";

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
      columns: true,
      blockPaste: true,
      createdAt: true,
      closedAt: true,
      notes: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          authorName: true,
          content: true,
          color: true,
          attachmentUrl: true,
          hidden: true,
          column: true,
          createdAt: true,
        },
      },
    },
  });
  return Response.json(board);
}

// PATCH — close/reopen board, và/hoặc cập nhật danh sách cột (grid theo nhóm).
// Đổi tên/xoá cột không đụng tới note đã có — note giữ nguyên nhãn cột gốc (xem schema).
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
    const { status, columns, blockPaste } = z
      .object({
        status: z.enum(["open", "closed"]).optional(),
        columns: z.array(z.string()).optional(),
        blockPaste: z.boolean().optional(),
      })
      .parse(body);
    if (status === undefined && columns === undefined && blockPaste === undefined) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    let normalizedColumns: string[] | undefined;
    if (columns !== undefined) {
      const result = normalizeBoardColumns(columns);
      if (result === null) {
        return Response.json({ error: "invalid_columns" }, { status: 400 });
      }
      normalizedColumns = result;
    }

    const updated = await prisma.interactiveBoard.update({
      where: { id: params.id },
      data: {
        ...(status !== undefined
          ? { status, closedAt: status === "closed" ? new Date() : null }
          : {}),
        ...(normalizedColumns !== undefined ? { columns: normalizedColumns } : {}),
        ...(blockPaste !== undefined ? { blockPaste } : {}),
      },
      select: { id: true, status: true, closedAt: true, columns: true, blockPaste: true },
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
