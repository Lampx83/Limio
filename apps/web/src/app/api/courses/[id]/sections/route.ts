import { NextResponse } from "next/server";
import {
  countUnassignedLearners,
  createCourseSection,
  getSectionScheduleSummaries,
  listCourseSections,
} from "@feedbackme/core-lms";
import { getCourseCenterAccess } from "@/lib/centerAccess";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const [sections, unassigned, centerEnabled] = await Promise.all([
      listCourseSections(userId, params.id),
      countUnassignedLearners(userId, params.id),
      getCourseCenterAccess(params.id),
    ]);
    // Tóm tắt lịch chỉ có khi khoá thuộc trung tâm (hoặc đã có lịch); không thì thẻ lớp giữ nguyên như trước.
    const schedules = centerEnabled ? await getSectionScheduleSummaries(userId, params.id) : null;
    return NextResponse.json({ sections, unassigned, centerEnabled, schedules });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const section = await createCourseSection(userId, params.id, body);
    return NextResponse.json({ section }, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
