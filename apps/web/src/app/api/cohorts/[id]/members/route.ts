import { NextResponse } from "next/server";
import {
  addCohortMembers,
  listCohortMembers,
  removeCohortMember,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const members = await listCohortMembers(userId, params.id);
    return NextResponse.json({ members });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/** Body: { add?: string[] (emails/uuids), removeUserId?: string } */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as
    | { add?: string[]; removeUserId?: string }
    | null;
  if (!body) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    if (Array.isArray(body.add) && body.add.length > 0) {
      const r = await addCohortMembers(userId, params.id, body.add);
      return NextResponse.json(r);
    }
    if (typeof body.removeUserId === "string") {
      await removeCohortMember(userId, params.id, body.removeUserId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
