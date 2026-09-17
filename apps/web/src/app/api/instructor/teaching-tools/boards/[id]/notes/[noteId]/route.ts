import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { publish } from "@/lib/realtime/publisher";
import { channelForBoard } from "@/lib/board";
import { BOARD_NOTE_COLORS, isValidAttachmentUrl } from "@/app/instructor/classroom/boardNoteStyle";

const COLOR_SET = new Set<string>(BOARD_NOTE_COLORS);

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

// PATCH — instructor ẩn/hiện note (moderation) và/hoặc sửa nội dung note (bất kỳ note nào,
// không giới hạn tác giả — GV có toàn quyền chỉnh sửa trên board của mình).
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; noteId: string } },
) {
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const auth1 = await authorize(params.id, params.noteId, userId);
  if ("error" in auth1) {
    return Response.json(
      { error: auth1.error },
      { status: auth1.error === "not_found" ? 404 : 403 },
    );
  }

  try {
    const body = await req.json();
    const parsed = z
      .object({
        hidden: z.boolean().optional(),
        content: z.string().max(500).optional(),
        attachmentUrl: z.string().max(2000).optional(),
        color: z.string().optional(),
      })
      .parse(body);
    const isEditingContent =
      parsed.content !== undefined || parsed.attachmentUrl !== undefined || parsed.color !== undefined;
    if (parsed.hidden === undefined && !isEditingContent) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    if (parsed.attachmentUrl && !isValidAttachmentUrl(parsed.attachmentUrl)) {
      return Response.json({ error: "invalid_attachment_url" }, { status: 400 });
    }

    if (isEditingContent) {
      const current = await prisma.boardNote.findUniqueOrThrow({
        where: { id: params.noteId },
        select: { content: true, attachmentUrl: true },
      });
      const nextContent = (parsed.content ?? current.content).trim();
      const nextAttachment = (parsed.attachmentUrl ?? current.attachmentUrl ?? "").trim();
      if (!nextContent && !nextAttachment) {
        return Response.json({ error: "content_or_attachment_required" }, { status: 400 });
      }
    }

    const updated = await prisma.boardNote.update({
      where: { id: params.noteId },
      data: {
        ...(parsed.hidden !== undefined ? { hidden: parsed.hidden } : {}),
        ...(parsed.content !== undefined ? { content: parsed.content.trim() } : {}),
        ...(parsed.attachmentUrl !== undefined
          ? { attachmentUrl: parsed.attachmentUrl.trim() || null }
          : {}),
        ...(parsed.color !== undefined && COLOR_SET.has(parsed.color) ? { color: parsed.color } : {}),
      },
      select: {
        id: true,
        authorName: true,
        content: true,
        color: true,
        attachmentUrl: true,
        column: true,
        hidden: true,
        createdAt: true,
      },
    });

    // Broadcast moderation event để học viên ẩn note ngay (nếu đang xem public view)
    if (parsed.hidden !== undefined) {
      publish(channelForBoard(params.id), {
        type: "note.moderated",
        noteId: updated.id,
        hidden: updated.hidden,
      }).catch(() => {});
    }
    if (isEditingContent) {
      publish(channelForBoard(params.id), { type: "note.updated", note: updated }).catch(() => {});
    }

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
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const auth1 = await authorize(params.id, params.noteId, userId);
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
