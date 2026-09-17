import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";

export async function GET() {
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const clouds = await prisma.wordCloud.findMany({
    where: { createdById: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      prompt: true,
      createdAt: true,
      _count: { select: { submissions: true } },
    },
  });

  return Response.json(clouds);
}
