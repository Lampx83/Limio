import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { authorizeGroupingOwner } from "@feedbackme/core-lms";
import { requireFeature } from "@/lib/session";

export async function PUT(
  req: Request,
  { params }: { params: { groupingId: string } }
) {
  const actorUserId = await requireFeature("teaching_tools.access");
  if (!actorUserId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  // IDOR guard — teaching_tools.access chỉ xác nhận "là giảng viên nào đó",
  // không xác nhận đây có phải giảng viên của ĐÚNG course chứa groupingId
  // này hay không. Không check riêng thì 1 GV biết groupingId của course
  // khác vẫn ghi đè được phân nhóm của người khác.
  const authz = await authorizeGroupingOwner(params.groupingId, actorUserId);
  if (!authz.ok) {
    return Response.json(
      { error: authz.error },
      { status: authz.error === "not_found" ? 404 : 403 },
    );
  }

  try {
    const body = await req.json();
    const { groups } = z
      .object({
        groups: z.array(
          z.object({
            groupNum: z.number().int().positive(),
            userIds: z.array(z.string()),
          })
        ),
      })
      .parse(body);

    // Verify grouping exists
    const grouping = await prisma.groupingSession.findUnique({
      where: { id: params.groupingId },
    });

    if (!grouping) {
      return Response.json({ error: "Grouping not found" }, { status: 404 });
    }

    // Delete all existing memberships and insert new ones in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete existing
      await tx.groupMembership.deleteMany({
        where: { groupingId: params.groupingId },
      });

      // Insert new assignments
      const memberships = groups.flatMap((group) =>
        group.userIds.map((userId) => ({
          groupingId: params.groupingId,
          groupNum: group.groupNum,
          userId,
        }))
      );

      await tx.groupMembership.createMany({
        data: memberships,
      });
    });

    // Return updated state
    const memberships = await prisma.groupMembership.findMany({
      where: { groupingId: params.groupingId },
      select: {
        groupNum: true,
        user: { select: { id: true, displayName: true } },
      },
      orderBy: [{ groupNum: "asc" }, { user: { displayName: "asc" } }],
    });

    const groupMap = new Map<number, any[]>();
    for (let i = 1; i <= grouping.numGroups; i++) {
      groupMap.set(i, []);
    }

    memberships.forEach((m) => {
      const group = groupMap.get(m.groupNum) || [];
      group.push({
        userId: m.user.id,
        name: m.user.displayName,
      });
      groupMap.set(m.groupNum, group);
    });

    const responseGroups = Array.from(groupMap.entries()).map(
      ([groupNum, members]) => ({
        groupNum,
        members,
      })
    );

    return Response.json({
      groupingId: params.groupingId,
      numGroups: grouping.numGroups,
      groups: responseGroups,
    });
  } catch (err) {
    console.error("[classroom/grouping/[groupingId]/update]", err);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
