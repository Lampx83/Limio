import { NextResponse } from "next/server";
import {
  commitMcqRowsToBank,
  type ParsedMcqRow,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Commit parsed rows into Question Bank. See quiz commit route for details. */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await readJson(req)) as { rows?: ParsedMcqRow[] } | null;
  if (!body?.rows || !Array.isArray(body.rows)) {
    return NextResponse.json(
      { error: "validation_failed", details: "missing_rows" },
      { status: 400 },
    );
  }

  try {
    const r = await commitMcqRowsToBank(userId, params.id, body.rows);
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
