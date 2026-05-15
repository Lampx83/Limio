import { NextResponse } from "next/server";
import { z } from "zod";
import { previewBlueprint, BlueprintCellSchema } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

const Body = z.object({
  lessonIds: z.array(z.string().uuid()).min(1),
  cells: z.array(BlueprintCellSchema),
});

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
    const result = await previewBlueprint(
      userId,
      params.id,
      parsed.data.lessonIds,
      parsed.data.cells,
    );
    return NextResponse.json(result);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
