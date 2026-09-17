import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { publish } from "@/lib/realtime/publisher";
import { channelForWhiteboard } from "@/lib/whiteboard";

export const runtime = "nodejs";

// POST — chuyển trang (chỉ chế độ "annotate tài liệu", pages.length > 0).
// Mọi client đang mở (host + guest) theo trang này qua SSE `doc.page.changed`
// — không có nav riêng cho guest, đảm bảo cả lớp luôn xem cùng 1 trang với GV.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const board = await prisma.whiteboard.findUnique({
    where: { id: params.id },
    select: { id: true, ownerId: true, pages: true },
  });
  if (!board) return Response.json({ error: "not_found" }, { status: 404 });
  if (board.ownerId !== userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const pages = board.pages as unknown as { url: string }[];
  if (pages.length === 0) {
    return Response.json({ error: "not_document_mode" }, { status: 400 });
  }

  let page: number;
  try {
    const body = await req.json();
    ({ page } = z.object({ page: z.number().int().min(0).max(pages.length - 1) }).parse(body));
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  await prisma.whiteboard.update({ where: { id: params.id }, data: { currentPage: page } });

  publish(channelForWhiteboard(params.id), {
    type: "doc.page.changed",
    page,
  }).catch((err) => {
    console.error("[whiteboards/page] publish failed (non-fatal):", err);
  });

  return Response.json({ ok: true, page });
}
