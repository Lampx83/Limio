import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { publish } from "@/lib/realtime/publisher";
import { rateLimit } from "@/lib/realtime/rateLimit";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { cloudId: string } }
) {
  // Public endpoint — no login required (QR code submission from classroom)
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Rate limit theo IP — 1 submission/5s per cloud. Chống spam khi cả lớp gửi
  // đồng loạt. Fail-open nếu Redis lỗi (rateLimit() tự handle).
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`wordcloud:${params.cloudId}:${ip}`, 1, 5_000);
  if (!rl.ok) {
    return Response.json(
      { error: "rate_limited", resetMs: rl.resetMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } },
    );
  }

  try {
    const body = await req.json();
    const { text } = z.object({ text: z.string().min(1).max(100) }).parse(body);

    const wordCloud = await prisma.wordCloud.findUnique({
      where: { id: params.cloudId },
      select: { id: true },
    });

    if (!wordCloud) {
      return Response.json({ error: "Word cloud not found" }, { status: 404 });
    }

    const submissionCount = await prisma.wordCloudSubmission.count({
      where: { cloudId: params.cloudId },
    });

    if (submissionCount >= 500) {
      return Response.json(
        { error: "Word cloud has reached maximum submissions (500)" },
        { status: 400 }
      );
    }

    const submission = await prisma.wordCloudSubmission.create({
      data: { cloudId: params.cloudId, userId, text: text.trim() },
    });

    // Broadcast tới SSE subscribers. Không await được lỗi — fire-and-forget với
    // catch để DB insert đã thành công không bị rollback vì Redis lỗi.
    // Client polling endpoint /results vẫn là fallback nếu Redis chết.
    publish(`wordcloud:${params.cloudId}`, {
      text: submission.text,
      ts: submission.createdAt.getTime(),
    }).catch((err) => {
      console.error("[word-cloud/submit] publish failed (non-fatal):", err);
    });

    return Response.json({ cloudId: submission.cloudId, text: submission.text });
  } catch (err) {
    console.error("[classroom/word-cloud/submit]", err);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
