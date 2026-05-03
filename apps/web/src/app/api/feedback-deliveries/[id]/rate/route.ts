import { NextResponse } from "next/server";
import { FeedbackRatingError, rateFeedback } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { rating?: number } | null;
  if (!body || typeof body.rating !== "number") {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    await rateFeedback(userId, params.id, body.rating);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof FeedbackRatingError) {
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
