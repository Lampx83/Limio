import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { addCoInstructorByEmail, listCourseInstructors } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

// GET /api/courses/[id]/instructors — list owner + co-instructors.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await listCourseInstructors(params.id);
  return NextResponse.json(rows);
}

// POST /api/courses/[id]/instructors — Body: { email, role }
// Owner-only. If email has an account → attached immediately. If not → a
// no-password account is created and a "set your password" email is sent.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { email?: unknown; role?: unknown };
  if (typeof body?.email !== "string")
    return NextResponse.json({ error: "email required" }, { status: 400 });
  if (typeof body?.role !== "string")
    return NextResponse.json({ error: "role required" }, { status: 400 });

  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  try {
    const r = await addCoInstructorByEmail(
      userId,
      params.id,
      body.email,
      body.role,
      baseUrl,
    );
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
