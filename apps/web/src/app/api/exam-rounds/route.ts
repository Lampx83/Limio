import { NextResponse } from "next/server";
import { createExamRound, listExamRounds } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId") ?? undefined;
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam === "draft" ||
    statusParam === "open" ||
    statusParam === "closed" ||
    statusParam === "archived"
      ? statusParam
      : undefined;
  try {
    const rounds = await listExamRounds(userId, { courseId, status });
    return NextResponse.json({ rounds });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const r = await createExamRound(userId, body);
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
