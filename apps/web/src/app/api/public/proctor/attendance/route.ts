import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ExamError, setAttendanceByProctorCode } from "@feedbackme/core-lms";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import {
  PROCTOR_SESSION_COOKIE,
  verifyProctorSession,
} from "@/lib/proctor-session";

export const runtime = "nodejs";

/**
 * Điểm danh một thí sinh. Body: { candidateId, present }.
 *
 * roomId lấy từ COOKIE, không lấy từ body — nếu để client gửi lên thì cầm mã
 * phòng A có thể điểm danh người phòng B.
 */
export async function POST(req: Request) {
  const token = cookies().get(PROCTOR_SESSION_COOKIE)?.value;
  const payload = token ? verifyProctorSession(token) : null;
  if (!payload) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await readJson(req)) as Record<string, unknown> | null;
  if (!body || typeof body.candidateId !== "string")
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  try {
    const r = await setAttendanceByProctorCode(
      payload.roomId,
      body.candidateId,
      body.present === true,
    );
    return NextResponse.json(r);
  } catch (e) {
    // mapKnownError trả null cho lỗi nó không nhận ra — ném tiếp để thành 500
    // thật, đừng nuốt thành response rỗng.
    const mapped = e instanceof ExamError ? mapKnownError(e) : null;
    if (mapped) return mapped;
    throw e;
  }
}
