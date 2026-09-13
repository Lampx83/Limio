import { prisma } from "@feedbackme/db";
import { getSnapshotPage, type WhiteboardSnapshot } from "@/lib/whiteboardReconcile";

export const runtime = "nodejs";

// GET — public snapshot: whiteboard + elements của 1 trang (không cần login).
// ?page=N để lấy đúng trang đó; bỏ trống → trang GV đang chiếu (currentPage),
// đảm bảo guest join giữa chừng vào đúng trang đang dạy.
export async function GET(req: Request, { params }: { params: { code: string } }) {
  const board = await prisma.whiteboard.findUnique({
    where: { code: params.code.toUpperCase() },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      snapshot: true,
      pages: true,
      currentPage: true,
      kioskMode: true,
      createdAt: true,
    },
  });
  if (!board) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const pageParam = new URL(req.url).searchParams.get("page");
  const page = pageParam !== null ? Number(pageParam) : board.currentPage;
  const elements = getSnapshotPage(board.snapshot as unknown as WhiteboardSnapshot, page);

  return Response.json({
    id: board.id,
    code: board.code,
    title: board.title,
    status: board.status,
    pages: board.pages,
    currentPage: board.currentPage,
    kioskMode: board.kioskMode,
    page,
    snapshot: elements,
    createdAt: board.createdAt,
  });
}
