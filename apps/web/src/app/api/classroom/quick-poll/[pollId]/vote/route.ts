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

  let parsedBody: { choice: string; clientId?: string };
  try {
    parsedBody = z
      .object({ choice: z.string(), clientId: z.string().min(8).max(64).optional() })
      .parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { choice, clientId } = parsedBody;

  // Rate limit chính: 1 vote/5s theo THIẾT BỊ (clientId sinh ở client); client cũ không gửi thì
  // rơi về IP. Theo IP thì cả lớp chung wifi/NAT chỉ được 1 vote mỗi 5 giây.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(
    clientId ? `poll:${params.pollId}:client:${clientId}` : `poll:${params.pollId}:${ip}`,
    1,
    5_000,
  );
  if (!rl.ok) {
    return Response.json(
      { error: "rate_limited", resetMs: rl.resetMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } },
    );
  }
  // Lưới an toàn thô theo IP chống script tự đổi clientId — ngưỡng đủ rộng cho cả lớp lớn cùng NAT.
  const ipRl = await rateLimit(`poll:${params.pollId}:ip-burst:${ip}`, 300, 10_000);
  if (!ipRl.ok) {
    return Response.json(
      { error: "rate_limited", resetMs: ipRl.resetMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil(ipRl.resetMs / 1000)) } },
    );
  }

  try {
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
