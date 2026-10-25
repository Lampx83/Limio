import { NextResponse } from "next/server";
import { checkInToMeeting, editTeacherCheckIn, getMeetingCheckIn } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

async function guard<T>(fn: (userId: string) => Promise<T>) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await fn(userId));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/** Trạng thái "Bắt đầu buổi" của một buổi (CENTER C5): cửa sổ bấm, giáo viên dự kiến, ai đã bấm, đúng giờ hay trễ. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return guard((u) => getMeetingCheckIn(u, params.id));
}

/** Bấm "Bắt đầu buổi". Người có tên trong khoá; bấm lại không ghi đè. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return guard((u) => checkInToMeeting(u, params.id));
}

/** Quản trị trường sửa khi giáo viên quên bấm: { teacherId, checkedInAt, checkedOutAt?, reason } — lý do bắt buộc. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await readJson(req);
  return guard((u) => editTeacherCheckIn(u, params.id, body));
}
