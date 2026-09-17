import { z } from "zod";
import { Prisma, prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { generateUniqueWhiteboardCode } from "@/lib/whiteboard";

export const runtime = "nodejs";

// POST — instructor tạo whiteboard mới
export async function POST(req: Request) {
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { title, pages, kioskMode } = z
      .object({
        title: z.string().min(1).max(120),
        // B — Từ tài liệu: mảng URL ảnh nền, thứ tự = thứ tự trang. Rỗng/bỏ
        // trống = bảng trắng tự do (Phase A, không đổi hành vi). Path tương
        // đối (vd. "/api/whiteboard-media/x.png") — KHÔNG dùng z.string().url()
        // vì URL tuyệt đối lệch app basePath (xem lib/apiUrl.ts).
        pages: z.array(z.string().min(1).max(2000)).max(200).optional(),
        // C — Kiosk/triển lãm: set 1 lần lúc tạo, xem schema.prisma.
        kioskMode: z.boolean().optional(),
      })
      .parse(body);

    const code = await generateUniqueWhiteboardCode();
    const board = await prisma.whiteboard.create({
      data: {
        code,
        title: title.trim(),
        ownerId: userId,
        pages: (pages ?? []).map((url) => ({ url })) as unknown as Prisma.InputJsonValue,
        kioskMode: kioskMode ?? false,
      },
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

    return Response.json(board, { status: 201 });
  } catch (err) {
    console.error("[whiteboards POST]", err);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}

// GET — list whiteboard của instructor (gần nhất trước, tối đa 50)
export async function GET() {
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const boards = await prisma.whiteboard.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      kioskMode: true,
      createdAt: true,
      closedAt: true,
    },
  });
  return Response.json(boards);
}
