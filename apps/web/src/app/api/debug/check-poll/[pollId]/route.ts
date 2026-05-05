import { prisma } from "@feedbackme/db";

/**
 * DEBUG ENDPOINT ONLY - Check if a poll exists in database
 * Remove this file in production!
 */
export async function GET(
  req: Request,
  { params }: { params: { pollId: string } }
) {
  const pollId = params.pollId;

  console.log(`[DEBUG] Checking poll: ${pollId}`);

  try {
    // Check if poll exists
    const poll = await prisma.classroomPoll.findUnique({
      where: { id: pollId },
    });

    if (poll) {
      console.log(`[DEBUG] Poll FOUND in database:`, poll);
      return Response.json({
        status: "FOUND",
        pollId: poll.id,
        question: poll.question,
        optionCount: poll.options.length,
        sessionId: poll.sessionId,
        createdAt: poll.createdAt,
      });
    } else {
      console.log(`[DEBUG] Poll NOT FOUND in database for id: ${pollId}`);

      // Check if any polls exist at all
      const allPolls = await prisma.classroomPoll.findMany({
        select: { id: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      return Response.json({
        status: "NOT_FOUND",
        pollId: pollId,
        message: "Poll does not exist in database",
        recentPolls: allPolls.map((p) => ({
          id: p.id,
          createdAt: p.createdAt,
        })),
      });
    }
  } catch (error) {
    console.error(`[DEBUG] Error checking poll:`, error);
    return Response.json(
      {
        status: "ERROR",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
