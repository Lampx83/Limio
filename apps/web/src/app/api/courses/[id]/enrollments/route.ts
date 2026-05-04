import { auth } from "@/lib/auth";
import { prisma } from "@feedbackme/db";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const courseId = params.id;
    console.log("[enrollments API] Fetching enrollments for course:", courseId);

    // First, just fetch enrollmentIds
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      select: {
        userId: true,
      },
    });

    console.log("[enrollments API] Found", enrollments.length, "enrollments");

    if (enrollments.length === 0) {
      return Response.json([]);
    }

    // Then fetch user details
    const userIds = enrollments.map((e) => e.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        displayName: true,
      },
    });

    // Combine
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const result = enrollments.map((e) => ({
      userId: e.userId,
      user: userMap[e.userId],
    }));

    return Response.json(result);
  } catch (err) {
    console.error("[enrollments API] Error:", err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
