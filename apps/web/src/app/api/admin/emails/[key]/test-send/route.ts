import { NextResponse } from "next/server";
import {
  composeEmailHtml,
  getTemplateForScope,
  renderField,
  sendEmail,
} from "@feedbackme/core-lms";
import { requireScopeAccess } from "@/lib/emailAdminAuth";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * POST /api/admin/emails/[key]/test-send?scope=...
 * Body: { to: string; variables?: Record<string, string>; subject?, bodyHtml?, bodyText? }
 *
 * Sends a test email to ANY address (per teacher's request — useful for QA).
 * If subject/bodyHtml/bodyText are passed in the body, those are rendered
 * directly (used by the editor's "Send test" while the admin has unsaved
 * changes). Otherwise the saved template at scope is used.
 *
 * Variables default to the template's `variables[].example` values, so a
 * preview always renders meaningfully even with no overrides.
 */
export async function POST(
  req: Request,
  { params }: { params: { key: string } },
) {
  const url = new URL(req.url);
  const access = await requireScopeAccess(url.searchParams.get("scope"));
  if (!access.ok) return access.response;

  const body = (await readJson(req)) as Record<string, unknown> | null;
  if (!body)
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  const to = typeof body.to === "string" ? body.to.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const detail = await getTemplateForScope(params.key, access.scope);
  if (!detail)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Build example variable map from template metadata, then let caller override.
  const vars: Record<string, string> = {};
  for (const v of detail.variables) vars[v.name] = v.example ?? "";
  if (body.variables && typeof body.variables === "object") {
    for (const [k, val] of Object.entries(body.variables as Record<string, unknown>)) {
      if (val != null) vars[k] = String(val);
    }
  }

  // Allow editor to pass unsaved drafts for live test.
  const subjectTpl =
    typeof body.subject === "string" ? body.subject : detail.subject;
  const bodyHtmlTpl =
    typeof body.bodyHtml === "string" ? body.bodyHtml : detail.bodyHtml;
  const bodyTextTpl =
    typeof body.bodyText === "string"
      ? body.bodyText
      : (detail.bodyText ?? "");

  const subject = renderField(subjectTpl, vars);
  const text = bodyTextTpl ? renderField(bodyTextTpl, vars) : undefined;
  // Cùng pipeline với gửi thật: thêm style inline + khung thương hiệu.
  const html = composeEmailHtml(renderField(bodyHtmlTpl, vars), subject, text ?? "");

  // Prepend a clear "TEST" marker so it never gets mistaken for real mail.
  const result = await sendEmail({
    to,
    subject: `[TEST] ${subject}`,
    html,
    text,
  });
  return NextResponse.json({
    ...result,
    rendered: { subject, html, text: text ?? null },
  });
}
