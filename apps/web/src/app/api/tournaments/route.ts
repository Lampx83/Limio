import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { canEditCourse, isAdmin } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

const Input = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(20_000),
  courseId: z.string().uuid().optional().nullable(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  teamSize: z.number().int().positive().default(1),
  prizeXp: z.number().int().min(0).default(0),
});

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Admins can always create. Course-scoped tournaments require course-edit
  // rights on the linked course.
  const admin = await isAdmin(userId);
  if (parsed.data.courseId && !admin) {
    if (!(await canEditCourse(userId, parsed.data.courseId))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  } else if (!parsed.data.courseId && !admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (new Date(parsed.data.endsAt) <= new Date(parsed.data.startsAt)) {
    return NextResponse.json(
      { error: "validation_failed", details: "endsAt_before_startsAt" },
      { status: 400 },
    );
  }

  const t = await prisma.tournament.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      courseId: parsed.data.courseId ?? null,
      creatorId: userId,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      teamSize: parsed.data.teamSize,
      prizeXp: parsed.data.prizeXp,
    },
  });
  return NextResponse.json({ tournamentId: t.id }, { status: 201 });
}

export async function GET() {
  const tournaments = await prisma.tournament.findMany({
    where: { status: { in: ["published", "active"] } },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      startsAt: true,
      endsAt: true,
      teamSize: true,
      prizeXp: true,
      course: { select: { slug: true, title: true } },
    },
  });
  return NextResponse.json({ tournaments });
}
