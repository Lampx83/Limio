import { NextResponse } from "next/server";
import { getSectionGoal, setSectionGoal } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ goal: await getSectionGoal(userId, params.id) });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/** Đặt mục tiêu của lớp (C6.4): { goal: { framework, targetLevel, targetDate?, hoursPerWeek? } | null }; null = bỏ mục tiêu lớp. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { goal?: unknown } | null;
  if (!body || !("goal" in body)) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    return NextResponse.json({ goal: await setSectionGoal(userId, params.id, body.goal ?? null) });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
