import { NextResponse } from "next/server";
import { listRevisions } from "@feedbackme/core-lms";
import { requireScopeAccess } from "@/lib/emailAdminAuth";

export const runtime = "nodejs";

/** GET /api/admin/emails/[key]/history?scope=... — list revisions newest-first. */
export async function GET(
  req: Request,
  { params }: { params: { key: string } },
) {
  const url = new URL(req.url);
  const access = await requireScopeAccess(url.searchParams.get("scope"));
  if (!access.ok) return access.response;

  const revisions = await listRevisions(params.key, access.scope);
  return NextResponse.json({ revisions });
}
