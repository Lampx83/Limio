import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { publish } from "@/lib/realtime/publisher";
import { channelForWhiteboard } from "@/lib/whiteboard";

export const runtime = "nodejs";

async function authorizeOwner(boardId: string, userId: string) {
  const board = await prisma.whiteboard.findUnique({
    where: { id: boardId },
    select: { id: true, ownerId: true },
  });
  if (!board) return { error: "not_found" as const };
  if (board.ownerId !== userId) return { error: "forbidden" as const };
  return { board };
}

// GET — host view: whiteboard + snapshot elements hiện tại
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const auth1 = await authorizeOwner(params.id, userId);
  if ("error" in auth1) {
    return Response.json(
      { error: auth1.error },
      { status: auth1.error === "not_found" ? 404 : 403 },
    );
  }

  const board = await prisma.whiteboard.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      snapshot: true,
      pages: true,
      currentPage: true,
      createdAt: true,
      closedAt: true,
    },
  });
  return Response.json(board);
}

// PATCH — close/reopen whiteboard
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const auth1 = await authorizeOwner(params.id, userId);
  if ("error" in auth1) {
    return Response.json(
      { error: auth1.error },
      { status: auth1.error === "not_found" ? 404 : 403 },
    );
  }

  try {
    const body = await req.json();
    const { status } = z.object({ status: z.enum(["open", "closed"]) }).parse(body);
    const updated = await prisma.whiteboard.update({
      where: { id: params.id },
      data: {
        status,
        closedAt: status === "closed" ? new Date() : null,
      },
      select: { id: true, status: true, closedAt: true },
    });
    // Báo cho mọi client đang mở (kể cả tab host) chuyển view-mode ngay,
    // không cần đợi reload — tránh trường hợp đóng board xong host vẫn vẽ
    // được trên canvas của mình (server vẫn từ chối lưu, nhưng UI im lặng).
    publish(channelForWhiteboard(params.id), {
      type: "status.changed",
      status: updated.status,
    }).catch((err) => {
      console.error("[whiteboards PATCH] publish failed (non-fatal):", err);
    });
    return Response.json(updated);
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}

// DELETE — xoá whiteboard
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const auth1 = await authorizeOwner(params.id, userId);
  if ("error" in auth1) {
    return Response.json(
      { error: auth1.error },
      { status: auth1.error === "not_found" ? 404 : 403 },
    );
  }
  await prisma.whiteboard.delete({ where: { id: params.id } });
  return Response.json({ ok: true });
}
