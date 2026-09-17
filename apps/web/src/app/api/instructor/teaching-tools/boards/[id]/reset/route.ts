import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { publish } from "@/lib/realtime/publisher";
import { channelForBoard } from "@/lib/board";

export const runtime = "nodejs";

// Xoá toàn bộ note của board, giữ nguyên board (id + code + title/prompt) để
// giáo viên dạy nhiều lớp nhỏ dùng lại cùng 1 QR thay vì tạo board mới mỗi lớp.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const board = await prisma.interactiveBoard.findUnique({
    where: { id: params.id },
    select: { id: true, ownerId: true },
  });
  if (!board) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (board.ownerId !== userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.boardNote.deleteMany({ where: { boardId: params.id } });

  // Báo cho mọi SSE subscriber (tab host khác + tab public đang mở) biết để
  // đồng bộ về bảng trắng.
  publish(channelForBoard(params.id), { type: "board.reset" }).catch((err) => {
    console.error("[boards/reset] publish failed (non-fatal):", err);
  });

  return Response.json({ ok: true });
}
