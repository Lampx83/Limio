import { NextResponse } from "next/server";
import { commitAttempt, ScormError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = ((await readJson(req)) ?? {}) as Record<string, unknown>;
  try {
    await commitAttempt(userId, params.id, {
      lessonStatus: typeof body.lessonStatus === "string" ? body.lessonStatus : undefined,
      completionStatus:
        typeof body.completionStatus === "string" ? body.completionStatus : undefined,
      scoreRaw:
        typeof body.scoreRaw === "number"
          ? body.scoreRaw
          : body.scoreRaw === null
            ? null
            : undefined,
      scoreMin: typeof body.scoreMin === "number" ? body.scoreMin : undefined,
      scoreMax: typeof body.scoreMax === "number" ? body.scoreMax : undefined,
      suspendData:
        typeof body.suspendData === "string"
          ? body.suspendData
          : body.suspendData === null
            ? null
            : undefined,
      location:
        typeof body.location === "string"
          ? body.location
          : body.location === null
            ? null
            : undefined,
      totalTime: typeof body.totalTime === "string" ? body.totalTime : undefined,
      finished: body.finished === true ? true : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ScormError) {
      const status =
        e.code === "attempt_not_found"
          ? 404
          : e.code === "forbidden"
            ? 403
            : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
