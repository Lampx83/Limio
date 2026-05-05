import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { lessonId, question, options, isAnonymous } = z
      .object({
        lessonId: z.string().uuid().optional(),
        question: z.string().min(1),
        options: z.array(z.string().min(1)).min(2),
        isAnonymous: z.boolean().default(true),
      })
      .parse(body);

    let sessionId: string;

    // If lessonId provided, use classroom session
    if (lessonId) {
      // Verify lesson exists and user is instructor
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        select: {
          id: true,
          module: { select: { course: { select: { id: true } } } },
        },
      });

      if (!lesson) {
        return Response.json({ error: "Lesson not found" }, { status: 404 });
      }

      const courseId = lesson.module.course.id;

      // Check if user is instructor for this course
      const instructor = await prisma.courseInstructor.findUnique({
        where: {
          courseId_userId: { courseId, userId: session.user.id },
        },
      });

      if (!instructor) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }

      // Get or create classroom session
      const classroomSession = await prisma.classroomSession.findFirst({
        where: { lessonId, endedAt: null },
        select: { id: true },
      });

      sessionId =
        classroomSession?.id ||
        (
          await prisma.classroomSession.create({
            data: { lessonId },
            select: { id: true },
          })
        ).id;
    } else {
      // Standalone mode - create a temporary session without lesson
      const classroomSession = await prisma.classroomSession.create({
        data: {
          startedAt: new Date(),
        },
        select: { id: true },
      });
      sessionId = classroomSession.id;
    }

    // Create poll
    const poll = await prisma.classroomPoll.create({
      data: {
        sessionId,
        question,
        options,
        isAnonymous,
      },
    });

    console.log("[classroom/quick-poll/create] Poll created successfully:", {
      pollId: poll.id,
      sessionId,
      question: poll.question,
      optionCount: poll.options.length,
    });

    return Response.json({
      id: poll.id,
      sessionId,
      question: poll.question,
      options: poll.options,
      isAnonymous: poll.isAnonymous,
    });
  } catch (err) {
    console.error("[classroom/quick-poll/create] Error:", err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[classroom/quick-poll/create] Message:", errorMsg);
    return Response.json({ error: errorMsg }, { status: 400 });
  }
}
