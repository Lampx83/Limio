import { LearningEventType } from "@feedbackme/shared-types";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { emitLiveEvent } from "@/lib/limioLiveEvents";
import { NARRATION_SPEEDS } from "@/lib/narration/learner";

export const runtime = "nodejs";

const KINDS = new Set(["lecture", "podcast"]);

/**
 * POST /api/me/narration-events — học viên bắt đầu, nghe hết hoặc dừng nghe giảng / podcast của bài
 * (docs/tieu-chi/nghe-giang-podcast.md, AC6). Trình duyệt gửi kiểu "gửi rồi quên" (keepalive, có khi lúc
 * đóng tab), nên luôn trả 204 nhanh; dữ liệu lạ thì bỏ. Đo lường không bao giờ được chặn hay làm chậm việc phát.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return new Response(null, { status: 204 });
  const body = (await readJson(req)) as Record<string, unknown> | null;
  const lessonId = body?.lessonId;
  const kind = body?.kind;
  if (typeof lessonId !== "string" || lessonId.length === 0 || lessonId.length > 64) return new Response(null, { status: 204 });
  if (typeof kind !== "string" || !KINDS.has(kind)) return new Response(null, { status: 204 });

  switch (body?.type) {
    case "started":
      await emitLiveEvent(userId, LearningEventType.NarrationStarted, { lessonId, kind, resumed: body.resumed === true });
      break;
    case "completed":
      await emitLiveEvent(userId, LearningEventType.NarrationCompleted, { lessonId, kind });
      break;
    case "stopped": {
      const percent = typeof body.percent === "number" && Number.isFinite(body.percent) ? Math.min(100, Math.max(0, Math.round(body.percent))) : null;
      const speed = typeof body.speed === "number" && (NARRATION_SPEEDS as readonly number[]).includes(body.speed) ? body.speed : 1;
      if (percent !== null) await emitLiveEvent(userId, LearningEventType.NarrationStopped, { lessonId, kind, percent, speed });
      break;
    }
  }
  return new Response(null, { status: 204 });
}
