import { prisma } from "@feedbackme/db";

export async function GET(
  req: Request,
  { params }: { params: { pollId: string } }
) {
  try {
    // Get poll details
    const poll = await prisma.classroomPoll.findUnique({
      where: { id: params.pollId },
      select: {
        id: true,
        question: true,
        options: true,
        isAnonymous: true,
        createdAt: true,
      },
    });

    if (!poll) {
      return Response.json({ error: "Poll not found" }, { status: 404 });
    }

    // Get vote counts
    const votes = await prisma.classroomPollVote.findMany({
      where: { pollId: params.pollId },
      select: { choice: true },
    });

    // Count votes per option
    const votesByOption: Record<string, number> = {};
    poll.options.forEach((_, idx) => {
      votesByOption[idx] = 0;
    });

    votes.forEach((vote) => {
      votesByOption[vote.choice] =
        (votesByOption[vote.choice] || 0) + 1;
    });

    return Response.json({
      id: poll.id,
      question: poll.question,
      options: poll.options,
      isAnonymous: poll.isAnonymous,
      totalVotes: votes.length,
      votesByOption,
    });
  } catch (err) {
    console.error("[classroom/quick-poll/results]", err);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
