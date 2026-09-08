import { NextResponse } from "next/server";
import { createCourse, isInstructor, listPublishedCourses } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = {
    category: url.searchParams.get("category") ?? undefined,
    level: url.searchParams.get("level") ?? undefined,
    language: url.searchParams.get("language") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
  };
  try {
    const result = await listPublishedCourses(query);
    return NextResponse.json(result);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Instructor status is admin-granted, not self-serve — createCourse() itself
  // no longer auto-promotes the caller (see courses.ts), so this is the one
  // place that actually stops a learner from creating a course over the API.
  if (!(await isInstructor(userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await readJson(req);
  try {
    const result = await createCourse(userId, body);
    // Scaffold a default 3 modules × 3 lessons skeleton so the editor opens
    // with a navigable structure instead of a blank state. Done here (API
    // layer) rather than in business logic so tests can call createCourse()
    // without hitting the (courseId, orderIndex) unique constraint.
    await prisma.$transaction(async (tx) => {
      for (let m = 0; m < 3; m++) {
        const moduleRow = await tx.module.create({
          data: {
            courseId: result.courseId,
            title: `Module ${m + 1}`,
            orderIndex: m,
          },
        });
        for (let l = 0; l < 3; l++) {
          await tx.lesson.create({
            data: {
              moduleId: moduleRow.id,
              title: `Bài học ${l + 1}`,
              orderIndex: l,
            },
          });
        }
      }
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
