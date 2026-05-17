import { NextResponse } from "next/server";
import { listTemplatesForScope } from "@feedbackme/core-lms";
import { requireScopeAccess } from "@/lib/emailAdminAuth";

export const runtime = "nodejs";

/** GET /api/admin/emails?scope=global|<orgId> — list all 13 templates at scope. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const access = await requireScopeAccess(url.searchParams.get("scope"));
  if (!access.ok) return access.response;

  const items = await listTemplatesForScope(access.scope);
  return NextResponse.json({ items });
}
