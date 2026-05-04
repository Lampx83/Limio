import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: { cloudId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { text } = z
      .object({
        text: z.string().min(1).max(100),
      })
      .parse(body);

    // Verify word cloud exists
    const wordCloud = await prisma.wordCloud.findUnique({
      where: { id: params.cloudId },
      select: {
        id: true,
        sessionId: true,
        session: { select: { lessonId: true } },
      },
    });

    if (!wordCloud) {
      return Response.json(
        { error: "Word cloud not found" },
        { status: 404 }
      );
    }

    // Check if user is enrolled in the course for this lesson
    const lesson = await prisma.lesson.findUnique({
      where: { id: wordCloud.session.lessonId },
      select: { module: { select: { course: { select: { id: true } } } } },
    });

    if (!lesson) {
      return Response.json({ error: "Lesson not found" }, { status: 404 });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId: lesson.module.course.id,
        },
      },
    });

    if (!enrollment) {
      return Response.json(
        { error: "Not enrolled in course" },
        { status: 403 }
      );
    }

    // Check if word cloud has reached 500 total submissions
    const submissionCount = await prisma.wordCloudSubmission.count({
      where: { cloudId: params.cloudId },
    });

    if (submissionCount >= 500) {
      return Response.json(
        { error: "Word cloud has reached maximum submissions (500)" },
        { status: 400 }
      );
    }

    // Create submission (allow multiple submissions per user)
    const submission = await prisma.wordCloudSubmission.create({
      data: {
        cloudId: params.cloudId,
        userId: session.user.id,
        text: text.trim(),
      },
    });

    return Response.json({
      cloudId: submission.cloudId,
      text: submission.text,
    });
  } catch (err) {
    console.error("[classroom/word-cloud/submit]", err);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
