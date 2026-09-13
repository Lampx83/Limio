import { prisma } from "@feedbackme/db";
import { sseResponse } from "@/lib/realtime/sse";
import { channelForWhiteboard } from "@/lib/whiteboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SSE stream cho whiteboard (public).
// Events:
//   { type: "elements.updated", elements: WhiteboardElement[] }  (batch mới, đã reconcile)
//   { type: "board.cleared" }
// Client fetch snapshot ban đầu qua GET /api/public/whiteboards/[code], sau
// đó áp các event từ stream này (đã có sẵn snapshot làm nền, không cần
// replay lại lịch sử — instructor.reset/elements route đều publish full
// batch cần thiết).
export async function GET(req: Request, { params }: { params: { code: string } }) {
  const board = await prisma.whiteboard.findUnique({
    where: { code: params.code.toUpperCase() },
    select: { id: true },
  });
  if (!board) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return sseResponse(channelForWhiteboard(board.id), req);
}
