import { NextResponse } from "next/server";
import { createBankQuestion, searchQuestions } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** List questions inside a specific bank (shortcut for searchQuestions). */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const status = url.searchParams.getAll("status") as ("draft" | "published" | "archived")[];
  const cognitiveLevel = url.searchParams.getAll("cognitiveLevel") as ("remember_understand" | "apply" | "analyze_plus")[];
  const reviewStatus = url.searchParams.getAll("reviewStatus") as ("pending" | "approved" | "needs_revision")[];
  const difficulty = url.searchParams.getAll("difficulty").map(Number).filter((n) => n >= 1 && n <= 5);
  const topics = url.searchParams.getAll("topic").filter((t) => t.trim() !== "");
  const q = url.searchParams.get("q") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  try {
    const r = await searchQuestions(userId, {
      bankIds: [params.id],
      status: status.length > 0 ? status : undefined,
      cognitiveLevel: cognitiveLevel.length > 0 ? cognitiveLevel : undefined,
      reviewStatus: reviewStatus.length > 0 ? reviewStatus : undefined,
      difficulty: difficulty.length > 0 ? difficulty : undefined,
      topics: topics.length > 0 ? topics : undefined,
      q,
      cursor,
      limit: 50,
    });
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const r = await createBankQuestion(userId, params.id, body);
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
