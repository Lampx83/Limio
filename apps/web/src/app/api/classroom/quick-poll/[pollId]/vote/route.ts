import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { publish } from "@/lib/realtime/publisher";
import { rateLimit } from "@/lib/realtime/rateLimit";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { pollId: string } }
) {
  // Public endpoint — no login required (QR code voting from classroom)
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Rate limit: 1 vote/5s/IP per poll. Chống spam click.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`poll:${params.pollId}:${ip}`, 1, 5_000);
  if (!rl.ok) {
    return Response.json(
      { error: "rate_limited", resetMs: rl.resetMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } },
    );
  }

  try {
    const body = await req.json();
    const { choice } = z.object({ choice: z.string() }).parse(body);

    const poll = await prisma.classroomPoll.findUnique({
      where: { id: params.pollId },
      select: { id: true, options: true },
    });

    if (!poll) {
      return Response.json({ error: "Poll not found" }, { status: 404 });
    }

    const choiceIndex = parseInt(choice);
    if (
      isNaN(choiceIndex) ||
      choiceIndex < 0 ||
      choiceIndex >= poll.options.length
    ) {
      return Response.json({ error: "Invalid choice" }, { status: 400 });
    }

    const submissionCount = await prisma.classroomPollVote.count({
      where: { pollId: params.pollId },
    });

    if (submissionCount >= 500) {
      return Response.json(
        { error: "Poll has reached maximum submissions (500)" },
        { status: 400 }
      );
    }

    const vote = await prisma.classroomPollVote.create({
      data: {
        pollId: params.pollId,
        userId,
        choice,
      },
    });

    // Broadcast realtime — fire-and-forget. /results vẫn là fallback nếu Redis down.
    publish(`poll:${params.pollId}`, {
      choice: vote.choice,
      ts: vote.createdAt.getTime(),
    }).catch((err) => {
      console.error("[quick-poll/vote] publish failed (non-fatal):", err);
    });

    return Response.json({
      pollId: vote.pollId,
      choice: vote.choice,
    });
  } catch (err) {
    console.error("[classroom/quick-poll/vote]", err);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
