import { NextResponse } from "next/server";
import {
  getTemplateForScope,
  removeOrgOverride,
  saveTemplate,
} from "@feedbackme/core-lms";
import { requireScopeAccess } from "@/lib/emailAdminAuth";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** GET /api/admin/emails/[key]?scope=... — fetch detail (inherits from global if no org override). */
export async function GET(
  req: Request,
  { params }: { params: { key: string } },
) {
  const url = new URL(req.url);
  const access = await requireScopeAccess(url.searchParams.get("scope"));
  if (!access.ok) return access.response;

  const detail = await getTemplateForScope(params.key, access.scope);
  if (!detail)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(detail);
}

/** PUT /api/admin/emails/[key]?scope=... — save subject/body/enabled. */
export async function PUT(
  req: Request,
  { params }: { params: { key: string } },
) {
  const url = new URL(req.url);
  const access = await requireScopeAccess(url.searchParams.get("scope"));
  if (!access.ok) return access.response;

  const body = (await readJson(req)) as Record<string, unknown> | null;
  if (!body)
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const bodyHtml = typeof body.bodyHtml === "string" ? body.bodyHtml : "";
  const bodyText =
    body.bodyText === null
      ? null
      : typeof body.bodyText === "string"
        ? body.bodyText
        : null;
  const enabled = typeof body.enabled === "boolean" ? body.enabled : true;

  if (!subject || !bodyHtml) {
    return NextResponse.json(
      { error: "subject and bodyHtml are required" },
      { status: 400 },
    );
  }

  try {
    const updated = await saveTemplate({
      key: params.key,
      scope: access.scope,
      subject,
      bodyHtml,
      bodyText,
      enabled,
      editorUserId: access.userId,
    });
    return NextResponse.json(updated);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("unknown_template_key:"))
      return NextResponse.json({ error: "unknown_template_key" }, { status: 404 });
    throw e;
  }
}

/**
 * DELETE /api/admin/emails/[key]?scope=<orgId> — remove org override so the
 * template falls back to global. Refused on scope=global.
 */
export async function DELETE(
  req: Request,
  { params }: { params: { key: string } },
) {
  const url = new URL(req.url);
  const access = await requireScopeAccess(url.searchParams.get("scope"));
  if (!access.ok) return access.response;

  if (access.scope === "global") {
    return NextResponse.json(
      { error: "cannot_delete_global_template" },
      { status: 400 },
    );
  }
  const result = await removeOrgOverride(params.key, access.scope.organizationId);
  return NextResponse.json(result);
}
