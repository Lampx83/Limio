import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { optOut?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.optOut !== "boolean") {
    return NextResponse.json({ error: "opt_out_must_be_boolean" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { leaderboardOptOut: body.optOut },
  });
  return NextResponse.json({ ok: true, optOut: body.optOut });
}
