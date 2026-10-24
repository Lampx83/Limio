import { LearningEventType } from "@feedbackme/shared-types";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { emitLiveEvent } from "@/lib/limioLiveEvents";

export const runtime = "nodejs";

const TARGETS = new Set(["sample", "catalog_course", "catalog_all"]);

/**
 * POST /api/me/onboarding-events — học viên bấm "Học thử" / "Xem khoá" / "Xem tất cả" trên trang Bắt đầu
 * (AC6). Trình duyệt gửi kiểu "gửi rồi quên" (keepalive) trước khi chuyển trang, nên luôn trả 204 nhanh,
 * dữ liệu lạ thì bỏ: đo lường không bao giờ được chặn hay làm chậm học viên.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return new Response(null, { status: 204 });
  const body = (await readJson(req)) as { target?: unknown; courseId?: unknown } | null;
  if (typeof body?.target === "string" && TARGETS.has(body.target)) {
    const courseId = typeof body.courseId === "string" && body.courseId.length <= 64 ? body.courseId : undefined;
    await emitLiveEvent(userId, LearningEventType.OnboardingStartClicked, { target: body.target, ...(courseId ? { courseId } : {}) });
  }
  return new Response(null, { status: 204 });
}
