import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

const Input = z.object({
  scope: z.enum(["generic", "per_misconception", "per_skill"]),
  body: z.string().trim().min(1).max(5_000),
  misconceptionId: z.string().uuid().optional().nullable(),
  skillId: z.string().uuid().optional().nullable(),
  priority: z.number().int().min(0).max(1000).optional(),
});

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [admin, anyCourse] = await Promise.all([
    isAdmin(userId),
    prisma.courseInstructor.findFirst({ where: { userId } }),
  ]);
  if (!admin && !anyCourse) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await readJson(req);
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const t = await prisma.feedbackTemplate.create({
    data: {
      scope: parsed.data.scope,
      body: parsed.data.body,
      misconceptionId: parsed.data.misconceptionId ?? null,
      skillId: parsed.data.skillId ?? null,
      priority: parsed.data.priority ?? 100,
    },
  });
  return NextResponse.json({ templateId: t.id }, { status: 201 });
}
