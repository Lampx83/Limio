import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { publish } from "@/lib/realtime/publisher";

// Xoá toàn bộ phiếu bầu của 1 poll, giữ nguyên poll (id + câu hỏi + lựa chọn)
// để giáo viên dạy nhiều lớp nhỏ dùng lại cùng 1 QR thay vì tạo poll mới mỗi lớp.
export async function POST(
  req: Request,
  { params }: { params: { pollId: string } }
) {
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const poll = await prisma.classroomPoll.findUnique({
      where: { id: params.pollId },
      select: { id: true, createdById: true, options: true },
    });

    if (!poll) {
      return Response.json({ error: "Poll not found" }, { status: 404 });
    }
    if (poll.createdById !== userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.classroomPollVote.deleteMany({
      where: { pollId: params.pollId },
    });

    const votesByOption: Record<string, number> = {};
    poll.options.forEach((_, idx) => {
      votesByOption[idx] = 0;
    });

    // Báo cho mọi SSE subscriber (tab host khác) biết để đồng bộ về trạng thái trắng.
    publish(`poll:${params.pollId}`, { reset: true }).catch((err) => {
      console.error("[quick-poll/reset] publish failed (non-fatal):", err);
    });

    return Response.json({
      id: poll.id,
      totalVotes: 0,
      votesByOption,
    });
  } catch (err) {
    console.error("[classroom/quick-poll/reset]", err);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
