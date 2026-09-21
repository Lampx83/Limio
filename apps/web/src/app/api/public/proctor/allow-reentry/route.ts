import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ExamError, grantReentryByProctorCode } from "@feedbackme/core-lms";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import {
  PROCTOR_SESSION_COOKIE,
  verifyProctorSession,
} from "@/lib/proctor-session";

export const runtime = "nodejs";

/**
 * Giám thị (vào bằng mã phòng) cho một thí sinh vào lại bài đang làm dở khi họ quên
 * email/SĐT đã nhập lần đầu. Body: { candidateId }. Quyền dùng một lần, hết hạn sau
 * ít phút — xem grantReentryByProctorCode.
 *
 * roomId lấy từ COOKIE, không lấy từ body (cùng lý do với route điểm danh): cầm mã
 * phòng A không mở được người phòng B.
 */
export async function POST(req: Request) {
  const token = cookies().get(PROCTOR_SESSION_COOKIE)?.value;
  const payload = token ? verifyProctorSession(token) : null;
  if (!payload) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await readJson(req)) as Record<string, unknown> | null;
  if (!body || typeof body.candidateId !== "string")
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  try {
    const r = await grantReentryByProctorCode(payload.roomId, body.candidateId);
    return NextResponse.json({ ok: true, expiresAt: r.expiresAt.toISOString() });
  } catch (e) {
    const mapped = e instanceof ExamError ? mapKnownError(e) : null;
    if (mapped) return mapped;
    throw e;
  }
}
