import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: { cloudId: string } }
) {
  // Public endpoint — no login required (QR code submission from classroom)
  const session = await auth();
  const userId = session?.user?.id ?? null;

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

    return Response.json({ cloudId: submission.cloudId, text: submission.text });
  } catch (err) {
    console.error("[classroom/word-cloud/submit]", err);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
