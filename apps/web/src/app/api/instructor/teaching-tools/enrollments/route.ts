import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { canEditCourse } from "@feedbackme/core-lms";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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
    const canEdit = await canEditCourse(session.user.id, courseId);
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
