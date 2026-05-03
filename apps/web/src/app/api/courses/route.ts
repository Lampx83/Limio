import { NextResponse } from "next/server";
import { createCourse, listPublishedCourses } from "@feedbackme/core-lms";
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
  const body = await readJson(req);
  try {
    const result = await createCourse(userId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
