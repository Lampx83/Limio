import { NextResponse } from "next/server";
import {
  createCourseTeam,
  getMyCourseTeam,
  joinCourseTeamByCode,
  leaveCourseTeam,
  regenerateCourseTeamCode,
  removeCourseTeamMember,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Nhóm của chính học viên trong khoá (docs/group-submission-AC.md mục A). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await getMyCourseTeam(userId, params.id));
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}

type Body =
  | { action: "create"; name?: string }
  | { action: "join"; code?: string }
  | { action: "leave" }
  | { action: "regenerate" }
  | { action: "remove"; userId?: string };

/** Mọi thao tác của học viên trên nhóm, phân theo `action`. Trả về trạng thái nhóm mới. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as Body;
  try {
    switch (body?.action) {
      case "create":
        await createCourseTeam(userId, params.id, String(body.name ?? ""));
        break;
      case "join":
        await joinCourseTeamByCode(userId, params.id, String(body.code ?? ""));
        break;
      case "leave":
        await leaveCourseTeam(userId, params.id);
        break;
      case "regenerate":
        await regenerateCourseTeamCode(userId, params.id);
        break;
      case "remove":
        if (!body.userId) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
        await removeCourseTeamMember(userId, params.id, body.userId);
        break;
      default:
        return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    }
    return NextResponse.json(await getMyCourseTeam(userId, params.id));
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}
