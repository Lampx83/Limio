import { NextResponse } from "next/server";
import {
  CatalogSectionError,
  addCourseToSection,
  listCoursesInSection,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

function mapError(e: unknown): NextResponse {
  if (e instanceof CatalogSectionError) {
    const status = e.code === "forbidden" ? 403 : e.code === "not_found" ? 404 : 400;
    return NextResponse.json(
      e.details ? { error: e.code, details: e.details } : { error: e.code },
      { status },
    );
  }
  throw e;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const courses = await listCoursesInSection(userId, params.id);
    return NextResponse.json({ courses });
  } catch (e) {
    return mapError(e);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { courseId?: string } | null;
  if (!body?.courseId) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    await addCourseToSection(userId, params.id, body.courseId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return mapError(e);
  }
}
