import { NextResponse } from "next/server";
import { buildOidcLoginUrl, LtiError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Initiate an LTI 1.3 launch from the learner's side.
 * Body: { toolId, resourceLinkId, courseId?, lessonId? }
 * Returns: { url } — the tool's OIDC login init URL with our query params.
 * Client browser then navigates to that URL (top window or popup).
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as Record<string, unknown> | null;
  if (!body?.toolId || !body?.resourceLinkId) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    const r = await buildOidcLoginUrl({
      toolId: String(body.toolId),
      userId,
      resourceLinkId: String(body.resourceLinkId),
      courseId: typeof body.courseId === "string" ? body.courseId : null,
      lessonId: typeof body.lessonId === "string" ? body.lessonId : null,
    });
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof LtiError) {
      return NextResponse.json(
        { error: e.code, details: e.details },
        { status: e.code === "tool_not_found" ? 404 : 400 },
      );
    }
    throw e;
  }
}
