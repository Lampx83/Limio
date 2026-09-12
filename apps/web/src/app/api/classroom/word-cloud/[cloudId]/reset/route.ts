import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { publish } from "@/lib/realtime/publisher";

// Xoá toàn bộ submission của 1 word cloud, giữ nguyên cloud (id + prompt) để
// giáo viên dạy nhiều lớp nhỏ dùng lại cùng 1 QR thay vì tạo cloud mới mỗi lớp.
export async function POST(
  req: Request,
  { params }: { params: { cloudId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const wordCloud = await prisma.wordCloud.findUnique({
      where: { id: params.cloudId },
      select: { id: true, createdById: true },
    });

    if (!wordCloud) {
      return Response.json({ error: "Word cloud not found" }, { status: 404 });
    }
    if (wordCloud.createdById !== session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.wordCloudSubmission.deleteMany({
      where: { cloudId: params.cloudId },
    });

    // Báo cho mọi SSE subscriber (tab host khác) biết để đồng bộ về trạng thái trắng.
    publish(`wordcloud:${params.cloudId}`, { reset: true }).catch((err) => {
      console.error("[word-cloud/reset] publish failed (non-fatal):", err);
    });

    return Response.json({
      cloudId: params.cloudId,
      totalSubmissions: 0,
      wordFrequency: {},
    });
  } catch (err) {
    console.error("[classroom/word-cloud/reset]", err);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
