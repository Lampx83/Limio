import { NextResponse } from "next/server";
import { publishCoursePack } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Quản trị: đưa một khoá thành giáo trình. Body: { courseId, slug, title, summary, language, outcomeLevel? }. */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { courseId?: string } & Record<string, unknown>;
  try {
    const { courseId, ...rest } = body ?? {};
    return NextResponse.json(await publishCoursePack(userId, String(courseId ?? ""), rest), { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
