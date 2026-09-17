import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { canEditCourse, calculateStudentSkillScores, balanceStudentsIntoGroups } from "@feedbackme/core-lms";

export async function POST(req: Request) {
  const actorUserId = await requireFeature("teaching_tools.access");
  if (!actorUserId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { lessonId, numGroups, groupSize } = z
      .object({
        lessonId: z.string(),
        numGroups: z.number().int().positive().optional(),
        groupSize: z.number().int().positive().optional(),
      })
      .parse(body);

    if (!numGroups && !groupSize) {
      return Response.json(
        { error: "Either numGroups or groupSize is required" },
        { status: 400 }
      );
    }

    // Get lesson and course
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

    // Get or create classroom session
    let classroomSession = await prisma.classroomSession.findFirst({
      where: { lessonId },
      select: { id: true },
      orderBy: { startedAt: "desc" },
    });

    if (!classroomSession) {
      classroomSession = await prisma.classroomSession.create({
        data: { lessonId },
        select: { id: true },
      });
    }

    // Verify instructor can edit this course
    const canEdit = await canEditCourse(actorUserId, courseId);
    if (!canEdit) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Calculate skill scores for all enrolled students
    const students = await calculateStudentSkillScores(courseId);

    if (students.length === 0) {
      return Response.json(
        { error: "No enrolled students in course" },
        { status: 400 }
      );
    }

    // Calculate number of groups
    const finalNumGroups = numGroups || Math.ceil(students.length / groupSize!);

    if (finalNumGroups < 1) {
      return Response.json(
        { error: "Invalid group configuration" },
        { status: 400 }
      );
    }

    // Balance students into groups
    const groupAssignments = balanceStudentsIntoGroups(
      students,
      finalNumGroups
    );

    // Create GroupingSession
    const groupingSession = await prisma.groupingSession.create({
      data: {
        session: { connect: { id: classroomSession.id } },
        numGroups: finalNumGroups,
      },
    });

    // Bulk insert GroupMembership records
    const memberships = groupAssignments.flatMap((group) =>
      group.userIds.map((userId) => ({
        groupingId: groupingSession.id,
        groupNum: group.groupNum,
        userId,
      }))
    );

    await prisma.groupMembership.createMany({
      data: memberships,
    });

    // Return grouped data with skill scores
    const responseGroups = groupAssignments.map((group) => ({
      groupNum: group.groupNum,
      members: students
        .filter((s) => group.userIds.includes(s.userId))
        .map((s) => ({
          userId: s.userId,
          name: s.userName,
          skillScore: Math.round(s.skillScore * 100),
        })),
    }));

    return Response.json({
      groupingId: groupingSession.id,
      numGroups: finalNumGroups,
      totalStudents: students.length,
      groups: responseGroups,
    });
  } catch (err) {
    console.error("[classroom/grouping/create]", err);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
