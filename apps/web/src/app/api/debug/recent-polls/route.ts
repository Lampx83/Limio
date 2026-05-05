import { prisma } from "@feedbackme/db";

/**
 * DEBUG ENDPOINT ONLY - List recent polls from database
 * Remove this file in production!
 */
export async function GET(req: Request) {
  console.log(`[DEBUG] Fetching recent polls`);

  try {
    const recentPolls = await prisma.classroomPoll.findMany({
      select: {
        id: true,
        question: true,
        sessionId: true,
        createdAt: true,
        options: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    console.log(`[DEBUG] Found ${recentPolls.length} polls`);

    return Response.json({
      status: "OK",
      count: recentPolls.length,
      polls: recentPolls.map((p) => ({
        id: p.id,
        question: p.question,
        sessionId: p.sessionId,
        optionCount: p.options.length,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error(`[DEBUG] Error fetching polls:`, error);
    return Response.json(
      {
        status: "ERROR",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
