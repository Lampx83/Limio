import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";

export async function GET(req: Request) {
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  // ?trash=1 → thùng rác (phiên GV đã xoá, chờ dọn vĩnh viễn sau 30 ngày); mặc định chỉ phiên còn dùng.
  const inTrash = new URL(req.url).searchParams.get("trash") === "1";
  const polls = await prisma.classroomPoll.findMany({
    // Poll sinh từ slide bài giảng tương tác (Limio-Live) nằm trong lịch sử bài giảng, không ở đây.
    where: {
      createdById: userId,
      session: { liveSessions: { none: {} } },
      deletedAt: inTrash ? { not: null } : null,
    },
    orderBy: inTrash ? { deletedAt: "desc" } : { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      question: true,
      options: true,
      isAnonymous: true,
      createdAt: true,
      deletedAt: true,
      _count: { select: { votes: true } },
    },
  });

  return Response.json(polls);
}
