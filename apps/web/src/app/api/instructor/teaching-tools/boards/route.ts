import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { listLiveRuntimeRefIds } from "@feedbackme/core-lms";
import { requireFeature } from "@/lib/session";
import { generateUniqueBoardCode, normalizeBoardColumns } from "@/lib/board";

export const runtime = "nodejs";

// POST — instructor tạo board mới
export async function POST(req: Request) {
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { title, prompt, columns, blockPaste, drawingMode } = z
      .object({
        title: z.string().min(1).max(120),
        prompt: z.string().max(500).optional(),
        columns: z.array(z.string()).optional(),
        blockPaste: z.boolean().optional(),
        drawingMode: z.boolean().optional(),
      })
      .parse(body);

    let normalizedColumns: string[] = [];
    if (columns) {
      const result = normalizeBoardColumns(columns);
      if (result === null) {
        return Response.json({ error: "invalid_columns" }, { status: 400 });
      }
      normalizedColumns = result;
    }

    const code = await generateUniqueBoardCode();
    const board = await prisma.interactiveBoard.create({
      data: {
        code,
        title: title.trim(),
        prompt: prompt?.trim() || null,
        columns: normalizedColumns,
        blockPaste: blockPaste ?? false,
        drawingMode: drawingMode ?? false,
        ownerId: userId,
      },
      select: {
        id: true,
        code: true,
        title: true,
        prompt: true,
        status: true,
        columns: true,
        blockPaste: true,
        drawingMode: true,
        createdAt: true,
      },
    });

    return Response.json(board, { status: 201 });
  } catch (err) {
    console.error("[boards POST]", err);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}

// GET — list board của instructor (gần nhất trước, tối đa 100)
export async function GET(req: Request) {
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  // Bảng sinh từ slide Limio-Live nằm trong lịch sử bài giảng, không ở đây.
  // ?trash=1 → thùng rác (phiên GV đã xoá, chờ dọn vĩnh viễn sau 30 ngày); mặc định chỉ phiên còn dùng.
  const inTrash = new URL(req.url).searchParams.get("trash") === "1";
  const liveRefIds = await listLiveRuntimeRefIds(userId, prisma);
  const boards = await prisma.interactiveBoard.findMany({
    where: { ownerId: userId, id: { notIn: liveRefIds }, deletedAt: inTrash ? { not: null } : null },
    orderBy: inTrash ? { deletedAt: "desc" } : { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      code: true,
      title: true,
      prompt: true,
      status: true,
      drawingMode: true,
      createdAt: true,
      closedAt: true,
      deletedAt: true,
      _count: { select: { notes: { where: { hidden: false } } } },
    },
  });
  return Response.json(boards);
}
