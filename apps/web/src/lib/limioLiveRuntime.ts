import { prisma, LiveSlideType } from "@feedbackme/db";

export type Runtime =
  | { kind: "content" }
  | { kind: "poll" | "quiz" | "word_cloud"; refId: string; joinPath: string }
  | { kind: "collaborate_board"; refId: string; code: string; joinPath: string };

/**
 * Describe the student-facing runtime (join path, code...) backing an
 * already-created ClassroomPoll/WordCloud/InteractiveBoard for a slide.
 * Shared by the presenter's navigate-slide route and the audience's
 * read-only poll route so both agree on the same shape.
 */
export async function describeRuntime(type: LiveSlideType, refId: string): Promise<Runtime> {
  if (type === "poll" || type === "quiz") {
    return { kind: type, refId, joinPath: `/learn/poll/${refId}` };
  }
  if (type === "word_cloud") {
    return { kind: "word_cloud", refId, joinPath: `/learn/word-cloud/${refId}` };
  }
  // collaborate_board
  const board = await prisma.interactiveBoard.findUnique({
    where: { id: refId },
    select: { code: true },
  });
  if (!board) throw new Error("Linked board no longer exists");
  return { kind: "collaborate_board", refId, code: board.code, joinPath: `/join/${board.code}` };
}
