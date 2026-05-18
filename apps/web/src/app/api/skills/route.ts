import { NextResponse } from "next/server";
import { createSkill, listSkills } from "@feedbackme/core-lms";
import { requireInstructor } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const skills = await listSkills({
    q: url.searchParams.get("q") ?? undefined,
    limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
  });
  return NextResponse.json({ items: skills });
}

/**
 * POST /api/skills — Tạo skill mới.
 *
 * Cho phép Instructor (hoặc Admin) tạo. Trước đây chỉ admin được tạo nhưng
 * UI SkillTagsEditor cho GV bấm "Tạo skill mới" → 403 → bug user báo.
 * Skills là taxonomy toàn cục (1 skill graph cho cả platform); GV là người
 * dạy môn nên là SME phù hợp để khai báo skill cho course của mình.
 * Idempotent qua `code` unique constraint trong createSkill.
 */
export async function POST(req: Request) {
  const userId = await requireInstructor();
  if (!userId)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
