import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { publish } from "@/lib/realtime/publisher";
import { rateLimit } from "@/lib/realtime/rateLimit";
import { peekClientId } from "@/lib/realtime/clientKey";
import { channelForBoard } from "@/lib/board";
import { BOARD_NOTE_COLORS, isAcceptableAttachmentUrl } from "@/app/instructor/classroom/boardNoteStyle";

export const runtime = "nodejs";

const COLOR_SET = new Set<string>(BOARD_NOTE_COLORS);

// PATCH — public: tác giả tự sửa note của mình (không cần login).
// Không có xác thực ownership ở server — UI chỉ hiện nút sửa cho note mà trình
// duyệt đó vừa tạo (lưu id vào localStorage), giống cơ chế trust-based đã dùng
// cho việc tự chọn nhóm lúc post. Không sửa authorName/column ở đây.
export async function PATCH(
  req: Request,
  { params }: { params: { code: string; noteId: string } },
) {
  const code = params.code.toUpperCase();

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const clientId = await peekClientId(req);
  const rl = await rateLimit(clientId ? `board:${code}:edit:client:${clientId}` : `board:${code}:edit:${ip}`, 1, 3_000);
  if (!rl.ok) {
    return Response.json(
      { error: "rate_limited", resetMs: rl.resetMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } },
    );
  }

  let body: { content?: string; color?: string; attachmentUrl?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = z
      .object({
        content: z.string().max(500),
        color: z.string().optional(),
        attachmentUrl: z.string().max(2000).optional(),
      })
      .refine((d) => d.content.trim().length > 0 || !!d.attachmentUrl?.trim(), {
        message: "content_or_attachment_required",
      })
      .parse(body);
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (parsed.attachmentUrl && !isAcceptableAttachmentUrl(parsed.attachmentUrl)) {
    return Response.json({ error: "invalid_attachment_url" }, { status: 400 });
  }

  const board = await prisma.interactiveBoard.findUnique({
    where: { code },
    select: { id: true, status: true },
  });
  if (!board) return Response.json({ error: "not_found" }, { status: 404 });
  if (board.status !== "open") {
    return Response.json({ error: "board_closed" }, { status: 403 });
  }

  const existing = await prisma.boardNote.findUnique({
    where: { id: params.noteId },
    select: { id: true, boardId: true },
  });
  if (!existing || existing.boardId !== board.id) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const updated = await prisma.boardNote.update({
    where: { id: params.noteId },
    data: {
      content: parsed.content.trim(),
      attachmentUrl: parsed.attachmentUrl?.trim() || null,
      ...(parsed.color && COLOR_SET.has(parsed.color) ? { color: parsed.color } : {}),
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

  publish(channelForBoard(board.id), { type: "note.updated", note: updated }).catch((err) => {
    console.error("[boards/public/notes/[noteId]] publish failed:", err);
  });

  return Response.json(updated);
}
