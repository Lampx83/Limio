import { prisma } from "@feedbackme/db";
import { sseResponse } from "@/lib/realtime/sse";
import { channelForBoard } from "@/lib/board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SSE stream cho board (public).
// Events:
//   { type: "note.created", note: {...} }
//   { type: "note.moderated", noteId, hidden }
//   { type: "note.deleted", noteId }
// Client áp event vào local state (đã có snapshot từ GET /api/public/boards/[code]).
export async function GET(req: Request, { params }: { params: { code: string } }) {
  const board = await prisma.interactiveBoard.findUnique({
    where: { code: params.code.toUpperCase() },
    select: { id: true },
  });
  if (!board) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return sseResponse(channelForBoard(board.id), req);
}
