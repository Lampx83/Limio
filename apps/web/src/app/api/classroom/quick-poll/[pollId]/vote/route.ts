import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: { pollId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { choice } = z.object({ choice: z.string() }).parse(body);

    // Verify poll exists
    const poll = await prisma.classroomPoll.findUnique({
      where: { id: params.pollId },
      select: {
        id: true,
        options: true,
        session: { select: { lessonId: true } },
      },
    });

    if (!poll) {
      return Response.json({ error: "Poll not found" }, { status: 404 });
    }

    // Verify choice is valid
    const choiceIndex = parseInt(choice);
    if (
      isNaN(choiceIndex) ||
      choiceIndex < 0 ||
      choiceIndex >= poll.options.length
    ) {
      return Response.json({ error: "Invalid choice" }, { status: 400 });
    }

    // Check if user is enrolled in the course for this lesson
    if (!poll.session.lessonId) {
      return Response.json({ error: "Invalid poll session" }, { status: 400 });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: poll.session.lessonId },
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

    // Check if poll has reached 500 total submissions
    const submissionCount = await prisma.classroomPollVote.count({
      where: { pollId: params.pollId },
    });

    if (submissionCount >= 500) {
      return Response.json(
        { error: "Poll has reached maximum submissions (500)" },
        { status: 400 }
      );
    }

    // Create vote (allow multiple votes per user)
    const vote = await prisma.classroomPollVote.create({
      data: {
        pollId: params.pollId,
        userId: session.user.id,
        choice,
      },
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
