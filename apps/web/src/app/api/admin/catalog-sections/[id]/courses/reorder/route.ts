import { NextResponse } from "next/server";
import { CatalogSectionError, reorderCoursesInSection } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { orderedCourseIds?: string[] } | null;
  if (!body?.orderedCourseIds || !Array.isArray(body.orderedCourseIds)) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    await reorderCoursesInSection(userId, params.id, body.orderedCourseIds);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof CatalogSectionError) {
      return NextResponse.json({ error: e.code }, { status: e.code === "forbidden" ? 403 : 400 });
    }
    throw e;
  }
}
