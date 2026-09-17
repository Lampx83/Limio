import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { notFound } from "next/navigation";

export async function POST(req: Request) {
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { lessonId } = z.object({ lessonId: z.string().uuid() }).parse(body);

    // Verify lesson exists and user is instructor
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        module: { select: { course: { select: { id: true } } } },
      },
    });

    if (!lesson) return notFound();

    const courseId = lesson.module.course.id;

    // Check if user is instructor for this course
    const instructor = await prisma.courseInstructor.findUnique({
      where: {
        courseId_userId: { courseId, userId },
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

    const sessionId =
      classroomSession?.id ||
      (
        await prisma.classroomSession.create({
          data: { lessonId },
          select: { id: true },
        })
      ).id;

    // Get all enrolled learners
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      select: { userId: true, user: { select: { id: true, displayName: true } } },
    });

    if (enrollments.length === 0) {
      return Response.json({ error: "No learners enrolled" }, { status: 400 });
    }

    // Get recently picked students in this session
    const recentPicks = await prisma.classroomRandomPick.findMany({
      where: { sessionId },
      select: { userId: true },
      orderBy: { pickedAt: "desc" },
      take: 5,
    });

    const recentUserIds = new Set(recentPicks.map((p) => p.userId));

    // Filter out recently picked students
    const available = enrollments.filter((e) => !recentUserIds.has(e.userId));
    const candidates = available.length > 0 ? available : enrollments;

    // Random selection
    const randomIndex = Math.floor(Math.random() * candidates.length);
    const selectedUserId = candidates[randomIndex]!.userId;

    // Record the pick
    await prisma.classroomRandomPick.create({
      data: {
        sessionId,
        userId: selectedUserId,
      },
    });

    const selected = candidates[randomIndex]!;

    return Response.json({
      userId: selected.userId,
      displayName: selected.user.displayName,
      sessionId,
      // Roster of candidates this pick was drawn from — lets the client animate
      // a reel through real names instead of just revealing the winner.
      roster: candidates.map((c) => c.user.displayName),
      winnerIndex: randomIndex,
    });
  } catch (err) {
    console.error("[classroom/random-pick]", err);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
