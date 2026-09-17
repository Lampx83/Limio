import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { canEditCourse } from "@feedbackme/core-lms";

export async function GET(req: Request) {
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId");

  if (!courseId) {
    return Response.json(
      { error: "courseId is required" },
      { status: 400 }
    );
  }

  try {
    // Verify instructor can edit this course
    const canEdit = await canEditCourse(userId, courseId);
    if (!canEdit) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch active enrollments with user info
    const enrollments = await prisma.enrollment.findMany({
      where: {
        courseId,
        status: "active",
      },
      select: {
        userId: true,
        user: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: {
        user: {
          displayName: "asc",
        },
      },
    });

    return Response.json({ enrollments });
  } catch (err) {
    console.error("[teaching-tools/enrollments]", err);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
