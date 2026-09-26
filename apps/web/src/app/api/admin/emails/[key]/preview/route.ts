import { NextResponse } from "next/server";
import { composeEmailHtml, getTemplateForScope, renderField } from "@feedbackme/core-lms";
import { requireScopeAccess } from "@/lib/emailAdminAuth";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * POST /api/admin/emails/[key]/preview?scope=...
 * Body: { subject?, bodyHtml?, bodyText? }  (bản nháp chưa lưu; thiếu thì lấy bản đã lưu)
 *
 * Trả HTML email HOÀN CHỈNH (đã thêm style inline + khung thương hiệu) với dữ liệu mẫu —
 * cùng đường xử lý với gửi thật và gửi test, nên xem trước = thứ người nhận sẽ thấy.
 */
export async function POST(req: Request, { params }: { params: { key: string } }) {
  const url = new URL(req.url);
  const access = await requireScopeAccess(url.searchParams.get("scope"));
  if (!access.ok) return access.response;

  const body = ((await readJson(req)) ?? {}) as Record<string, unknown>;
  const detail = await getTemplateForScope(params.key, access.scope);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const vars: Record<string, string> = {};
  for (const v of detail.variables) vars[v.name] = v.example ?? "";

  const subjectTpl = typeof body.subject === "string" ? body.subject : detail.subject;
  const bodyHtmlTpl = typeof body.bodyHtml === "string" ? body.bodyHtml : detail.bodyHtml;
  const bodyTextTpl = typeof body.bodyText === "string" ? body.bodyText : (detail.bodyText ?? "");

  const subject = renderField(subjectTpl, vars);
  const text = bodyTextTpl ? renderField(bodyTextTpl, vars) : "";
  const html = composeEmailHtml(renderField(bodyHtmlTpl, vars), subject, text);
  return NextResponse.json({ subject, html });
}
