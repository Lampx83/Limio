/**
 * Email template engine — admin-editable templates with org override
 * and hard-coded fallback.
 *
 * Lookup precedence:
 *   1. Per-organization row    (organizationId = orgId, enabled=true)
 *   2. Global default row      (organizationId = null,  enabled=true)
 *   3. Hard-coded fallback     (FALLBACKS map below)
 *
 * Render: Handlebars with safe defaults — missing variables become "".
 * Send:   delegates to sendEmail() and returns SendResult.
 */

import Handlebars from "handlebars";
import { prisma } from "@feedbackme/db";
import { sendEmail, type SendResult } from "./sender";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateKey =
  | "auth.verify_email"
  | "auth.password_reset"
  | "exam.access_code"
  | "exam.proctor_invite"
  | "exam.proctor_invite_bulk"
  | "exam.instructor_invite_bulk"
  | "cohort.instructor_invite"
  | "course.welcome"
  | "exam.grade_published"
  | "exam.deadline_reminder"
  | "gamification.level_up"
  | "gamification.badge_earned"
  | "notification.weekly_digest";

export type RenderedTemplate = {
  subject: string;
  html: string;
  text: string;
  source: "org" | "global" | "fallback";
};

export type SendTemplatedEmailInput = {
  key: TemplateKey;
  to: string;
  variables: Record<string, string | number | null | undefined>;
  organizationId?: string | null;
};

// ---------------------------------------------------------------------------
// Handlebars engine
// ---------------------------------------------------------------------------

Handlebars.registerHelper("helperMissing", () => "");
const compileCache = new Map<string, HandlebarsTemplateDelegate>();

function compile(source: string): HandlebarsTemplateDelegate {
  let fn = compileCache.get(source);
  if (!fn) {
    fn = Handlebars.compile(source, { noEscape: false });
    compileCache.set(source, fn);
  }
  return fn;
}

function normalizeVars(
  vars: Record<string, string | number | null | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    out[k] = v == null ? "" : String(v);
  }
  return out;
}

export function renderField(template: string, vars: Record<string, string>): string {
  try {
    return compile(template)(vars);
  } catch {
    return template;
  }
}

// ---------------------------------------------------------------------------
// DB lookup with org override
// ---------------------------------------------------------------------------

type LoadedTemplate = {
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  source: "org" | "global";
};

async function loadTemplate(
  key: string,
  organizationId: string | null | undefined,
): Promise<LoadedTemplate | null> {
  if (organizationId) {
    const orgRow = await prisma.emailTemplate.findFirst({
      where: { organizationId, key, enabled: true },
      select: { subject: true, bodyHtml: true, bodyText: true },
    });
    if (orgRow) return { ...orgRow, source: "org" };
  }
  const globalRow = await prisma.emailTemplate.findFirst({
    where: { organizationId: null, key, enabled: true },
    select: { subject: true, bodyHtml: true, bodyText: true },
  });
  if (globalRow) return { ...globalRow, source: "global" };
  return null;
}

// ---------------------------------------------------------------------------
// Hard-coded fallbacks
// ---------------------------------------------------------------------------
// Last-resort defaults if DB is empty or every layer is disabled. Keeps
// auth/exam emails working even with a broken DB. Minimal — see seed file
// for full rich versions.

const FALLBACKS: Record<string, { subject: string; bodyHtml: string; bodyText: string }> = {
  "auth.verify_email": {
    subject: "Xác thực email cho Limio.vn",
    bodyHtml: `<p>Xin chào {{displayName}},</p><p>Xác thực email (TTL 24h): <a href="{{verificationUrl}}">{{verificationUrl}}</a></p>`,
    bodyText: `Xin chào {{displayName}},\n\nXác thực email (TTL 24h):\n{{verificationUrl}}`,
  },
  "auth.password_reset": {
    subject: "Yêu cầu đặt lại mật khẩu cho Limio.vn",
    bodyHtml: `<p>Xin chào {{displayName}},</p><p>Đặt lại mật khẩu (TTL 1h): <a href="{{resetUrl}}">{{resetUrl}}</a></p>`,
    bodyText: `Xin chào {{displayName}},\n\nĐặt lại mật khẩu (TTL 1h):\n{{resetUrl}}`,
  },
  "exam.access_code": {
    subject: "[{{examTitle}}] Mã dự thi của bạn",
    bodyHtml: `<p>Xin chào {{candidateName}},</p><p>Mã dự thi: <strong>{{accessCode}}</strong></p><p>Vào thi: <a href="{{claimUrl}}">{{claimUrl}}</a></p>`,
    bodyText: `Xin chào {{candidateName}},\n\nMã dự thi: {{accessCode}}\nVào thi: {{claimUrl}}`,
  },
  "exam.proctor_invite": {
    subject: "Bạn được mời làm giám thị trên Limio.vn",
    bodyHtml: `<p>Xin chào {{name}},</p><p>Đặt mật khẩu (TTL 1h): <a href="{{resetUrl}}">{{resetUrl}}</a></p>`,
    bodyText: `Xin chào {{name}},\n\nĐặt mật khẩu (TTL 1h):\n{{resetUrl}}`,
  },
  "exam.proctor_invite_bulk": {
    subject: "Bạn được mời làm giám thị trên Limio.vn",
    bodyHtml: `<p>Xin chào {{name}},</p><p>Đặt mật khẩu: <a href="{{resetUrl}}">{{resetUrl}}</a></p>`,
    bodyText: `Xin chào {{name}},\n\nĐặt mật khẩu: {{resetUrl}}`,
  },
  "exam.instructor_invite_bulk": {
    subject: "Bạn được mời làm GV phụ trách lớp trên Limio.vn",
    bodyHtml: `<p>Xin chào {{name}},</p><p>Đặt mật khẩu: <a href="{{resetUrl}}">{{resetUrl}}</a></p>`,
    bodyText: `Xin chào {{name}},\n\nĐặt mật khẩu: {{resetUrl}}`,
  },
  "cohort.instructor_invite": {
    subject: "Bạn được mời làm GV phụ trách lớp trên Limio.vn",
    bodyHtml: `<p>Xin chào {{name}},</p><p>Đặt mật khẩu (TTL 1h): <a href="{{resetUrl}}">{{resetUrl}}</a></p>`,
    bodyText: `Xin chào {{name}},\n\nĐặt mật khẩu (TTL 1h):\n{{resetUrl}}`,
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function renderTemplate(input: {
  key: TemplateKey;
  variables: Record<string, string | number | null | undefined>;
  organizationId?: string | null;
}): Promise<RenderedTemplate> {
  const vars = normalizeVars(input.variables);
  const loaded = await loadTemplate(input.key, input.organizationId);

  if (loaded) {
    const html = renderField(loaded.bodyHtml, vars);
    const text = loaded.bodyText ? renderField(loaded.bodyText, vars) : stripHtml(html);
    return {
      subject: renderField(loaded.subject, vars),
      html,
      text,
      source: loaded.source,
    };
  }

  const fb = FALLBACKS[input.key];
  if (!fb) {
    throw new Error(
      `No template found for key=${input.key} (no DB row + no hard-coded fallback)`,
    );
  }
  return {
    subject: renderField(fb.subject, vars),
    html: renderField(fb.bodyHtml, vars),
    text: renderField(fb.bodyText, vars),
    source: "fallback",
  };
}

export async function sendTemplatedEmail(
  input: SendTemplatedEmailInput,
): Promise<SendResult & { source: RenderedTemplate["source"] }> {
  const rendered = await renderTemplate({
    key: input.key,
    variables: input.variables,
    organizationId: input.organizationId ?? null,
  });
  const result = await sendEmail({
    to: input.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
  return { ...result, source: rendered.source };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}
