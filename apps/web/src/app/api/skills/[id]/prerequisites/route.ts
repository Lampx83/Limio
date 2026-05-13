import { NextResponse } from "next/server";
import { z } from "zod";
import { addSkillPrerequisite, getSkillDetail } from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

const BodySchema = z.object({ prerequisiteSkillId: z.string().uuid() });

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { skill } = await getSkillDetail(params.id);
    return NextResponse.json({
      prerequisites: skill.prerequisites.map((e) => e.prerequisite),
      dependents: skill.dependents.map((e) => e.skill),
    });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const raw = await readJson(req);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    const result = await addSkillPrerequisite(
      params.id,
      parsed.data.prerequisiteSkillId,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
