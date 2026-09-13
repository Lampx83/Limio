import { NextResponse } from "next/server";
import { searchQuestions } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** Cross-bank search. Query params: type, difficulty, skill, q, status, cursor. */
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const numList = (k: string) =>
    sp.getAll(k).map((s) => Number(s)).filter((n) => Number.isFinite(n));
  const r = await searchQuestions(userId, {
    type: sp.getAll("type"),
    difficulty: numList("difficulty"),
    skillIds: sp.getAll("skill"),
    bankIds: sp.getAll("bank"),
    topics: sp.getAll("topic"),
    q: sp.get("q") ?? undefined,
    status: sp.getAll("status") as ("draft" | "published" | "archived")[],
    cursor: sp.get("cursor") ?? undefined,
    limit: Number(sp.get("limit") ?? "30"),
  });
  return NextResponse.json(r);
}
