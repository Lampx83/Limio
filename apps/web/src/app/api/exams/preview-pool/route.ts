import { NextResponse } from "next/server";
import { z } from "zod";
import { WizardConfig, previewPool } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * A5.5 — Stateless preview for the wizard "Tạo đề trong 3 bước".
 * Returns per-bucket availability and deficits without persisting anything.
 * Called on slider drag (debounced FE-side) to populate the PoolPreviewBar.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await readJson(req);
  const parsed = WizardConfig.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await previewPool(parsed.data, userId);
    return NextResponse.json(result);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
