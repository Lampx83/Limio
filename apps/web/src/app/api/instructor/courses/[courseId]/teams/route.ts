import { NextResponse } from "next/server";
import {
  getCourseTeamsOverview,
  instructorMoveTeamMember,
  instructorRenameCourseTeam,
  instructorSetTeamCaptain,
  updateCourseTeamSettings,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Tổng quan nhóm của khoá cho GV (docs/group-submission-AC.md mục B). */
export async function GET(_req: Request, { params }: { params: { courseId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await getCourseTeamsOverview(userId, params.courseId));
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}

/** Đổi số người tối đa / khoá-mở khoá danh sách. */
export async function PATCH(req: Request, { params }: { params: { courseId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { teamMaxSize?: number | null; locked?: boolean };
  try {
    await updateCourseTeamSettings(userId, params.courseId, {
      ...(body?.teamMaxSize !== undefined && { teamMaxSize: body.teamMaxSize }),
      ...(body?.locked !== undefined && { locked: body.locked }),
    });
    return NextResponse.json(await getCourseTeamsOverview(userId, params.courseId));
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}

type Body =
  | { action: "move"; userId?: string; toTeamId?: string | null }
  | { action: "captain"; teamId?: string; userId?: string }
  | { action: "rename"; teamId?: string; name?: string };

/** Chuyển / thêm / gỡ thành viên, đổi trưởng nhóm — được cả khi đã khoá. */
export async function POST(req: Request, { params }: { params: { courseId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as Body;
  try {
    if (body?.action === "move" && body.userId) {
      await instructorMoveTeamMember(userId, params.courseId, body.userId, body.toTeamId ?? null);
    } else if (body?.action === "captain" && body.teamId && body.userId) {
      await instructorSetTeamCaptain(userId, params.courseId, body.teamId, body.userId);
    } else if (body?.action === "rename" && body.teamId) {
      await instructorRenameCourseTeam(userId, params.courseId, body.teamId, String(body.name ?? ""));
    } else {
      return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    }
    return NextResponse.json(await getCourseTeamsOverview(userId, params.courseId));
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}
