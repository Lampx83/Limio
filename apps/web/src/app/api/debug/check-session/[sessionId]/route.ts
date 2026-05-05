import { prisma } from "@feedbackme/db";

/**
 * DEBUG ENDPOINT ONLY - Check if a classroom session exists in database
 * Remove this file in production!
 */
export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  const sessionId = params.sessionId;

  console.log(`[DEBUG] Checking session: ${sessionId}`);

  try {
    // Check if session exists
    const session = await prisma.classroomSession.findUnique({
      where: { id: sessionId },
      include: {
        polls: { select: { id: true } },
        wordClouds: { select: { id: true } },
      },
    });

    if (session) {
      console.log(`[DEBUG] Session FOUND in database:`, session);
      return Response.json({
        status: "FOUND",
        sessionId: session.id,
        lessonId: session.lessonId,
        startedAt: session.startedAt,
        pollCount: session.polls.length,
        wordCloudCount: session.wordClouds.length,
        polls: session.polls.map((p) => p.id),
      });
    } else {
      console.log(`[DEBUG] Session NOT FOUND in database for id: ${sessionId}`);

      // Check if any sessions exist
      const allSessions = await prisma.classroomSession.findMany({
        select: { id: true, startedAt: true },
        orderBy: { startedAt: "desc" },
        take: 5,
      });

      return Response.json({
        status: "NOT_FOUND",
        sessionId: sessionId,
        message: "Session does not exist in database",
        recentSessions: allSessions.map((s) => ({
          id: s.id,
          startedAt: s.startedAt,
        })),
      });
    }
  } catch (error) {
    console.error(`[DEBUG] Error checking session:`, error);
    return Response.json(
      {
        status: "ERROR",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
