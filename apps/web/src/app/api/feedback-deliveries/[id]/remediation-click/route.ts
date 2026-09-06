import { NextResponse } from "next/server";
import {
  RemediationClickError,
  recordRemediationClick,
} from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

/**
 * B9.2 — the learner opened a lesson this feedback routed them to.
 *
 * Fire-and-forget from the client: navigation must never wait on, or be
 * cancelled by, this call.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await readJson(req)) as { lessonId?: string } | null;
  if (!body?.lessonId || typeof body.lessonId !== "string") {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  try {
    await recordRemediationClick(userId, params.id, body.lessonId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof RemediationClickError) {
      const status =
        e.code === "delivery_not_found"
          ? 404
          : e.code === "forbidden"
            ? 403
            : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
