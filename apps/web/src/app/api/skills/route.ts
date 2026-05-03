import { NextResponse } from "next/server";
import { createSkill, listSkills } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const skills = await listSkills({
    q: url.searchParams.get("q") ?? undefined,
    limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
  });
  return NextResponse.json({ items: skills });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const result = await createSkill(body);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
