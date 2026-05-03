import { NextResponse } from "next/server";
import { CourseAuthzError, CourseError, reorderModules } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { orderedModuleIds?: string[] } | null;
  if (!body?.orderedModuleIds || !Array.isArray(body.orderedModuleIds)) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    await reorderModules(userId, params.id, body.orderedModuleIds);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof CourseError || e instanceof CourseAuthzError) {
      return NextResponse.json({ error: e.code }, { status: 400 });
    }
    throw e;
  }
}
