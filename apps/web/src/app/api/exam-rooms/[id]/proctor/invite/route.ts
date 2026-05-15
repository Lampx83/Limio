import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { inviteUserAsProctor } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

// POST /api/exam-rooms/[id]/proctor/invite
// Body: { email, displayName }
// - If email exists → assign as proctor, no email sent
// - If not → create pending user + send invite email with reset link
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as {
    email?: unknown;
    displayName?: unknown;
  };
  if (typeof body?.email !== "string" || typeof body?.displayName !== "string")
    return NextResponse.json(
      { error: "email + displayName required" },
      { status: 400 },
    );
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;
  try {
    const r = await inviteUserAsProctor(
      userId,
      params.id,
      body.email,
      body.displayName,
      baseUrl,
    );
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
