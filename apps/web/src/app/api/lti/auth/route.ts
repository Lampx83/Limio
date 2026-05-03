import { NextResponse } from "next/server";
import { LtiError, mintIdToken } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * LTI 1.3 OIDC auth endpoint. Tool redirects browser here with the OIDC
 * params (state, nonce, client_id, redirect_uri, login_hint, lti_message_hint).
 * We mint an id_token JWT and return an auto-submitting HTML form that POSTs
 * (id_token + state) to the tool's redirect_uri.
 *
 * Both GET (when tool uses 302 redirect) and POST (form_post) are supported.
 */
async function handle(params: URLSearchParams): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.redirect(
      new URL(`/signin?callbackUrl=${encodeURIComponent("/")}`, "http://localhost:3000"),
    );
  }

  const state = params.get("state") ?? "";
  const nonce = params.get("nonce") ?? "";
  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const loginHint = params.get("login_hint") ?? "";
  const messageHint = params.get("lti_message_hint") ?? "{}";

  if (!state || !nonce || !clientId || !redirectUri || !loginHint) {
    return new NextResponse("missing_required_param", { status: 400 });
  }

  // Confirm login_hint matches authenticated user (prevents tool from spoofing
  // a different sub claim).
  if (loginHint !== userId) {
    return new NextResponse("login_hint_mismatch", { status: 403 });
  }

  const tool = await prisma.ltiTool.findUnique({ where: { clientId } });
  if (!tool) return new NextResponse("tool_not_found", { status: 404 });

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { displayName: true, email: true },
  });
  const [given_name, ...rest] = user.displayName.split(" ");
  const family_name = rest.join(" ") || undefined;

  let ctx: { resourceLinkId: string; courseId?: string | null; lessonId?: string | null };
  try {
    ctx = JSON.parse(messageHint);
  } catch {
    ctx = { resourceLinkId: "default" };
  }

  try {
    const { idToken, redirectUri: redir, state: st } = await mintIdToken(
      tool.id,
      {
        sub: userId,
        name: user.displayName,
        email: user.email,
        given_name,
        family_name,
      },
      {
        state,
        nonce,
        client_id: clientId,
        redirect_uri: redirectUri,
        login_hint: loginHint,
      },
      ctx,
    );
    // Auto-submit form per LTI 1.3 form_post response_mode.
    const html = `<!doctype html>
<html><head><title>Launching…</title></head>
<body onload="document.forms[0].submit()">
<form method="POST" action="${escapeHtml(redir)}">
  <input type="hidden" name="id_token" value="${escapeHtml(idToken)}" />
  <input type="hidden" name="state" value="${escapeHtml(st)}" />
  <noscript><button type="submit">Continue</button></noscript>
</form>
</body></html>`;
    return new NextResponse(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    if (e instanceof LtiError) {
      return new NextResponse(`lti_error: ${e.code}`, { status: 400 });
    }
    throw e;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(req: Request) {
  return handle(new URL(req.url).searchParams);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const params = new URLSearchParams();
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") params.append(k, v);
  }
  return handle(params);
}
