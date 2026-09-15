import { NextResponse } from "next/server";
import { z } from "zod";
import {
  previewBlueprint,
  previewBlueprintTopicOnly,
  SkillMatrixCellSchema,
  TopicCellSchema,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

const Body = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("skill_matrix"),
    lessonIds: z.array(z.string().uuid()).min(1),
    cells: z.array(SkillMatrixCellSchema),
  }),
  z.object({
    mode: z.literal("topic_only"),
    cells: z.array(TopicCellSchema),
    bankIds: z.array(z.string().uuid()).optional(),
  }),
]);

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  const parsed = Body.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    const result =
      parsed.data.mode === "skill_matrix"
        ? await previewBlueprint(
            userId,
            params.id,
            parsed.data.lessonIds,
            parsed.data.cells,
          )
        : await previewBlueprintTopicOnly(
            userId,
            params.id,
            parsed.data.cells,
            undefined,
            parsed.data.bankIds,
          );
    return NextResponse.json(result);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
