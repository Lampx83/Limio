import { NextResponse } from "next/server";
import { addMeetingPlanLessons, getMeetingPlan, resetMeetingPlan, setMeetingPlan } from "@feedbackme/core-lms";
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

/** Kế hoạch giảng dạy hiệu lực của một buổi (CENTER J): bài theo thứ tự, chủ đề, đã tuỳ chỉnh hay theo giáo trình, sửa được không. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return guard((u) => getMeetingPlan(u, params.id));
}

/** Thay toàn bộ kế hoạch: { lessonIds: string[] theo thứ tự, topic?: string | null }. Người quản khoá. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = (await readJson(req)) as { lessonIds?: string[]; topic?: string | null } | null;
  return guard((u) => setMeetingPlan(u, params.id, { lessonIds: body?.lessonIds as string[], topic: body?.topic }));
}

/** Thêm bài vào cuối kế hoạch: { lessonIds: string[] }. Lần đầu chép danh sách theo giáo trình trước. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = (await readJson(req)) as { lessonIds?: string[] } | null;
  return guard((u) => addMeetingPlanLessons(u, params.id, body?.lessonIds as string[]));
}

/** "Đặt lại theo giáo trình". */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return guard((u) => resetMeetingPlan(u, params.id));
}
