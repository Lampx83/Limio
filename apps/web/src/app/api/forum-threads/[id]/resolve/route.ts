import { NextResponse } from "next/server";
import { ForumError, markPostResolved } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { postId?: string } | null;
  if (!body?.postId) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    await markPostResolved(userId, params.id, body.postId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForumError) {
      const status =
        e.code === "thread_not_found" || e.code === "post_not_found"
          ? 404
          : e.code === "forbidden"
            ? 403
            : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
