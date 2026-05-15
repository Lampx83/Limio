import { NextResponse } from "next/server";
import {
  bulkCreateCandidates,
  createCandidate,
  listCandidates,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const rows = await listCandidates(userId, params.id);
    return NextResponse.json({ candidates: rows });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/** Single create OR bulk create (when body.bulk is array). */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as
    | { displayName?: string; metadata?: Record<string, unknown>; bulk?: { displayName: string; metadata?: Record<string, unknown> }[] }
    | null;
  if (!body)
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    if (Array.isArray(body.bulk)) {
      const r = await bulkCreateCandidates(userId, params.id, body.bulk);
      return NextResponse.json(r);
    }
    const r = await createCandidate(userId, params.id, {
      displayName: body.displayName ?? "",
      metadata: body.metadata,
    });
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
