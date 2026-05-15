import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

const Body = z.object({ enabled: z.boolean() });

/** A5.5 — Persist expert assessment mode preference to User record. */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await readJson(req);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { expertAssessmentMode: parsed.data.enabled },
  });

  return NextResponse.json({ ok: true });
}
