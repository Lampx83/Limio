import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: { groupingId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get grouping session
    const groupingSession = await prisma.groupingSession.findUnique({
      where: { id: params.groupingId },
      select: {
        id: true,
        numGroups: true,
        name: true,
      },
    });

    if (!groupingSession) {
      return Response.json({ error: "Grouping not found" }, { status: 404 });
    }

    // Get all members with their info
    const memberships = await prisma.groupMembership.findMany({
      where: { groupingId: params.groupingId },
      select: {
        groupNum: true,
        user: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: [{ groupNum: "asc" }, { user: { displayName: "asc" } }],
    });

    // Group by groupNum
    const groupMap = new Map<number, any[]>();
    for (let i = 1; i <= groupingSession.numGroups; i++) {
      groupMap.set(i, []);
    }

    memberships.forEach((m) => {
      const group = groupMap.get(m.groupNum) || [];
      group.push({
        userId: m.user.id,
        name: m.user.displayName,
        email: m.user.email,
      });
      groupMap.set(m.groupNum, group);
    });

    const groups = Array.from(groupMap.entries()).map(([groupNum, members]) => ({
      groupNum,
      members,
    }));

    return Response.json({
      groupingId: params.groupingId,
      numGroups: groupingSession.numGroups,
      name: groupingSession.name,
      groups,
    });
  } catch (err) {
    console.error("[classroom/grouping/[groupingId]/members]", err);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
