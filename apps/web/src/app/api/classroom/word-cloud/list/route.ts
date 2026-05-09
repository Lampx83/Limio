import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clouds = await prisma.wordCloud.findMany({
    where: { createdById: session.user.id },
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
