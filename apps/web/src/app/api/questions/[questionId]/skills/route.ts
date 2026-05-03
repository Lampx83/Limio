import { NextResponse } from "next/server";
import { tagQuestionSkill } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export async function POST(
  req: Request,
  { params }: { params: { questionId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { skillId?: string } | null;
  if (!body?.skillId) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    const result = await tagQuestionSkill(userId, params.questionId, body.skillId);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
