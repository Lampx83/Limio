import { prisma } from "@feedbackme/db";

export const runtime = "nodejs";

// GET — public snapshot: thông tin board + notes (chỉ hidden=false)
export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const board = await prisma.interactiveBoard.findUnique({
    where: { code: params.code.toUpperCase() },
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
      notes: {
        where: { hidden: false },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          authorName: true,
          content: true,
          color: true,
          attachmentUrl: true,
          column: true,
          createdAt: true,
        },
      },
    },
  });
  if (!board) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json(board);
}
