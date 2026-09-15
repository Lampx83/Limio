import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { generateUniqueBoardCode, normalizeBoardColumns } from "@/lib/board";

export const runtime = "nodejs";

// POST — instructor tạo board mới
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, prompt, columns } = z
      .object({
        title: z.string().min(1).max(120),
        prompt: z.string().max(500).optional(),
        columns: z.array(z.string()).optional(),
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
        ownerId: session.user.id,
      },
      select: { id: true, code: true, title: true, prompt: true, status: true, columns: true, createdAt: true },
    });

    return Response.json(board, { status: 201 });
  } catch (err) {
    console.error("[boards POST]", err);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}

// GET — list board của instructor (gần nhất trước, tối đa 50)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const boards = await prisma.interactiveBoard.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      code: true,
      title: true,
      prompt: true,
      status: true,
      createdAt: true,
      closedAt: true,
      _count: { select: { notes: { where: { hidden: false } } } },
    },
  });
  return Response.json(boards);
}
