import { NextResponse } from "next/server";
import { canGradeCourse } from "@feedbackme/core-lms";
import { getLanguageProfile } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Dữ liệu học tập của một người: không cache ở proxy/CDN, chỉ riêng người xem.
const HEADERS = { "cache-control": "private, no-store" };

/**
 * LANG G3 — GET /api/courses/:id/language-profile[?userId=]
 *
 * Hồ sơ 4 kỹ năng. Không có `userId` (hoặc bằng chính mình) → xem của mình, dạng
 * "learner" (không số). Có `userId` người khác → phải là giảng viên/trợ giảng của
 * khoá (`canGradeCourse`), nhận dạng "instructor" (có mastery và bằng chứng).
 *
 * Quyền kiểm ở đây rồi truyền `audience` xuống core-feedback, vì core-feedback không
 * được import core-lms (§4.3).
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const viewerId = await requireUserId();
  if (!viewerId) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: HEADERS });

  const target = new URL(req.url).searchParams.get("userId") ?? viewerId;
  if (!UUID.test(target)) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400, headers: HEADERS });
  }

  const own = target === viewerId;
  if (!own && !(await canGradeCourse(viewerId, params.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: HEADERS });
  }

  const audience = own ? "learner" : "instructor";
  const profile = await getLanguageProfile(target, params.id, audience);

  if (!profile.enabled && profile.reason === "course_not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: HEADERS });
  }

  // Học viên không được biết mình thuộc lớp đối chứng (B10) hay khoá nào đang bật/tắt
  // tính năng: mọi lý do "tắt" gộp thành một. Giảng viên nhận lý do thật để chẩn đoán.
  if (audience === "learner" && !profile.enabled) {
    const masked =
      profile.reason === "control_variant" ||
      profile.reason === "personalization_off" ||
      profile.reason === "language_mode_off";
    if (masked) {
      return NextResponse.json({ ...profile, reason: "unavailable" }, { headers: HEADERS });
    }
  }

  return NextResponse.json(profile, { headers: HEADERS });
}
