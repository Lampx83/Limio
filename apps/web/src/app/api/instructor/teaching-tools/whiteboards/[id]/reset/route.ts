import { Prisma, prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { publish } from "@/lib/realtime/publisher";
import { channelForWhiteboard } from "@/lib/whiteboard";
import { clearSnapshotPage, type WhiteboardSnapshot } from "@/lib/whiteboardReconcile";

export const runtime = "nodejs";

// Xoá nét vẽ, giữ nguyên whiteboard (id + code + title) — giống reset của
// InteractiveBoard, để dùng lại QR cho lớp/lượt tiếp theo.
// ?page=N (chế độ tài liệu) → chỉ xoá trang đó, giữ trang khác. Không có
// page → xoá toàn bộ mọi trang (bảng trắng tự do luôn rơi vào nhánh này vì
// chỉ có 1 trang ảo "0").
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const board = await prisma.whiteboard.findUnique({
    where: { id: params.id },
    select: { id: true, ownerId: true, snapshot: true },
  });
  if (!board) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (board.ownerId !== session.user.id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const pageParam = new URL(req.url).searchParams.get("page");
  const page = pageParam !== null ? Number(pageParam) : null;

  const nextSnapshot: WhiteboardSnapshot =
    page !== null && Number.isInteger(page) && page >= 0
      ? clearSnapshotPage(board.snapshot as unknown as WhiteboardSnapshot, page)
      : {};

  await prisma.whiteboard.update({
    where: { id: params.id },
    data: { snapshot: nextSnapshot as unknown as Prisma.InputJsonValue },
  });

  publish(channelForWhiteboard(params.id), {
    type: "board.cleared",
    ...(page !== null ? { page } : {}),
  }).catch((err) => {
    console.error("[whiteboards/reset] publish failed (non-fatal):", err);
  });

  return Response.json({ ok: true });
}
