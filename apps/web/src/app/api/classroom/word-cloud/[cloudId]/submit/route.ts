import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { publish } from "@/lib/realtime/publisher";
import { rateLimit } from "@/lib/realtime/rateLimit";

export const runtime = "nodejs";

const BodySchema = z.object({
  text: z.string().min(1).max(100),
  // Định danh ẩn danh theo thiết bị (localStorage, sinh ở client). Dùng làm
  // rate-limit key chính thay vì IP — cả lớp dùng chung wifi/NAT sẽ ra cùng 1
  // IP nên rate-limit theo IP chặn nhầm học viên gửi hợp lệ (chỉ 1 lần).
  clientId: z.string().min(1).max(64).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { cloudId: string } }
) {
  // Public endpoint — no login required (QR code submission from classroom)
  const session = await auth();
  const userId = session?.user?.id ?? null;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // Rate limit chính: 1 submission/5s theo clientId (fallback về IP nếu client
  // cũ/không gửi kèm). Đúng người gửi, không bị dồn chung khi cả lớp cùng IP.
  const primaryKey = body.clientId
    ? `wordcloud:${params.cloudId}:client:${body.clientId}`
    : `wordcloud:${params.cloudId}:ip:${ip}`;
  const rl = await rateLimit(primaryKey, 1, 5_000);
  if (!rl.ok) {
    return Response.json(
      { error: "rate_limited", resetMs: rl.resetMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } },
    );
  }

  // Lưới an toàn thô theo IP — chặn spam hàng loạt (vd. script tự đổi
  // clientId) nhưng ngưỡng đủ rộng để không chặn cả lớp gửi đồng loạt qua
  // chung 1 IP (NAT trường học).
  const ipRl = await rateLimit(`wordcloud:${params.cloudId}:ip-burst:${ip}`, 60, 10_000);
  if (!ipRl.ok) {
    return Response.json(
      { error: "rate_limited", resetMs: ipRl.resetMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil(ipRl.resetMs / 1000)) } },
    );
  }

  try {
    const { text } = body;

    const wordCloud = await prisma.wordCloud.findUnique({
      where: { id: params.cloudId },
      select: { id: true },
    });

    if (!wordCloud) {
      return Response.json({ error: "Word cloud not found" }, { status: 404 });
    }

    const submissionCount = await prisma.wordCloudSubmission.count({
      where: { cloudId: params.cloudId },
    });

    if (submissionCount >= 500) {
      return Response.json(
        { error: "Word cloud has reached maximum submissions (500)" },
        { status: 400 }
      );
    }

    const submission = await prisma.wordCloudSubmission.create({
      data: { cloudId: params.cloudId, userId, text: text.trim() },
    });

    // Broadcast tới SSE subscribers. Không await được lỗi — fire-and-forget với
    // catch để DB insert đã thành công không bị rollback vì Redis lỗi.
    // Client polling endpoint /results vẫn là fallback nếu Redis chết.
    publish(`wordcloud:${params.cloudId}`, {
      text: submission.text,
      ts: submission.createdAt.getTime(),
    }).catch((err) => {
      console.error("[word-cloud/submit] publish failed (non-fatal):", err);
    });

    return Response.json({ cloudId: submission.cloudId, text: submission.text });
  } catch (err) {
    console.error("[classroom/word-cloud/submit]", err);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
