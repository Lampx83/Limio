import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const polls = await prisma.classroomPoll.findMany({
    where: { createdById: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      question: true,
      options: true,
      isAnonymous: true,
      createdAt: true,
      _count: { select: { votes: true } },
    },
  });

  return Response.json(polls);
}
