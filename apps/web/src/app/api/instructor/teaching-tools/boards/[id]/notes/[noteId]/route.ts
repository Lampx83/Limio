import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { publish } from "@/lib/realtime/publisher";
import { channelForBoard } from "@/lib/board";

export const runtime = "nodejs";

async function authorize(boardId: string, noteId: string, userId: string) {
  const note = await prisma.boardNote.findUnique({
    where: { id: noteId },
    select: { id: true, boardId: true, board: { select: { ownerId: true } } },
  });
  if (!note || note.boardId !== boardId) return { error: "not_found" as const };
  if (note.board.ownerId !== userId) return { error: "forbidden" as const };
  return { note };
}

// PATCH — instructor ẩn/hiện note (moderation)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; noteId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const auth1 = await authorize(params.id, params.noteId, session.user.id);
  if ("error" in auth1) {
    return Response.json(
      { error: auth1.error },
      { status: auth1.error === "not_found" ? 404 : 403 },
    );
  }

  try {
    const body = await req.json();
    const { hidden } = z.object({ hidden: z.boolean() }).parse(body);
    const updated = await prisma.boardNote.update({
      where: { id: params.noteId },
      data: { hidden },
      select: { id: true, hidden: true },
    });

    // Broadcast moderation event để học viên ẩn note ngay (nếu đang xem public view)
    publish(channelForBoard(params.id), {
      type: "note.moderated",
      noteId: updated.id,
      hidden: updated.hidden,
    }).catch(() => {});

    return Response.json(updated);
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}

// DELETE — xóa note vĩnh viễn
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; noteId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const auth1 = await authorize(params.id, params.noteId, session.user.id);
  if ("error" in auth1) {
    return Response.json(
      { error: auth1.error },
      { status: auth1.error === "not_found" ? 404 : 403 },
    );
  }
  await prisma.boardNote.delete({ where: { id: params.noteId } });

  publish(channelForBoard(params.id), {
    type: "note.deleted",
    noteId: params.noteId,
  }).catch(() => {});

  return Response.json({ ok: true });
}
