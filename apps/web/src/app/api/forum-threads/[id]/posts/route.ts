import { NextResponse } from "next/server";
import { ForumError, postReply } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const r = await postReply(userId, params.id, body);
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    if (e instanceof ForumError) {
      const status =
        e.code === "thread_not_found"
          ? 404
          : e.code === "not_enrolled"
            ? 403
            : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
