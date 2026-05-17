import { NextResponse } from "next/server";
import { revertToRevision } from "@feedbackme/core-lms";
import { requireScopeAccess } from "@/lib/emailAdminAuth";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * POST /api/admin/emails/[key]/revert?scope=...
 * Body: { revisionId: string }
 * Restores subject/body from the given revision. The revert itself is
 * recorded as a new revision so it can be undone.
 */
export async function POST(
  req: Request,
  { params }: { params: { key: string } },
) {
  const url = new URL(req.url);
  const access = await requireScopeAccess(url.searchParams.get("scope"));
  if (!access.ok) return access.response;

  const body = (await readJson(req)) as { revisionId?: unknown } | null;
  const revisionId = typeof body?.revisionId === "string" ? body.revisionId : "";
  if (!revisionId)
    return NextResponse.json({ error: "revisionId required" }, { status: 400 });

  try {
    const updated = await revertToRevision({
      key: params.key,
      scope: access.scope,
      revisionId,
      editorUserId: access.userId,
    });
    return NextResponse.json(updated);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "template_not_found_for_scope" || msg === "revision_not_found")
      return NextResponse.json({ error: msg }, { status: 404 });
    throw e;
  }
}
