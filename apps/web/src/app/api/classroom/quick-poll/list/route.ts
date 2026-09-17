import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";

export async function GET() {
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const polls = await prisma.classroomPoll.findMany({
    where: { createdById: userId },
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
