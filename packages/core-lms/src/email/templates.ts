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
 *         Nội dung (fragment) được bọc khung thương hiệu bằng wrapEmail(), trừ khi
 *         admin đã dán nguyên một tài liệu HTML hoàn chỉnh (có thẻ <html>).
 * Send:   delegates to sendEmail() and returns SendResult.
 */

import Handlebars from "handlebars";
import { prisma } from "@feedbackme/db";
import { sendEmail, type SendResult } from "./sender";
import { wrapEmail } from "./layout";

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
  | "course.co_instructor_invite"
  | "course.welcome"
  | "course.access_expiring"
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
  "course.co_instructor_invite": {
    subject: "Bạn được thêm làm đồng giảng viên khóa \"{{courseTitle}}\" trên Limio.vn",
    bodyHtml: `<p>Xin chào,</p><p>Bạn vừa được thêm làm đồng giảng viên khóa <strong>{{courseTitle}}</strong>. Đặt mật khẩu để đăng nhập (TTL 1h): <a href="{{resetUrl}}">{{resetUrl}}</a></p>`,
    bodyText: `Xin chào,\n\nBạn vừa được thêm làm đồng giảng viên khóa {{courseTitle}}. Đặt mật khẩu để đăng nhập (TTL 1h):\n{{resetUrl}}`,
  },
  "course.access_expiring": {
    subject: "Khóa \"{{courseTitle}}\" của bạn sắp hết hạn truy cập",
    bodyHtml: `<p>Xin chào {{learnerName}},</p><p>Quyền truy cập khóa <strong>{{courseTitle}}</strong> của bạn sẽ hết hạn vào <strong>{{expiresAtDate}}</strong>. Gia hạn sớm để không bị gián đoạn việc học.</p>`,
    bodyText: `Xin chào {{learnerName}},\n\nQuyền truy cập khóa {{courseTitle}} của bạn sẽ hết hạn vào {{expiresAtDate}}. Gia hạn sớm để không bị gián đoạn việc học.`,
  },
  "course.welcome": {
    subject: "Chào mừng bạn đến với {{courseTitle}}!",
    bodyHtml: `<p>Xin chào {{learnerName}},</p><p>Chào mừng bạn đến với khoá học <strong>{{courseTitle}}</strong> trên Limio.vn!</p><p>Bắt đầu học: <a href="{{courseUrl}}">{{courseUrl}}</a></p>`,
    bodyText: `Xin chào {{learnerName}},\n\nChào mừng bạn đến với khoá học {{courseTitle}}.\nBắt đầu học tại: {{courseUrl}}`,
  },
  "exam.grade_published": {
    subject: "[{{examTitle}}] Kết quả thi của bạn đã có",
    bodyHtml: `<p>Xin chào {{candidateName}},</p><p>Kết quả kỳ thi <strong>{{examTitle}}</strong> đã được công bố.</p><p><strong>Điểm: {{score}} / {{maxScore}}</strong></p><p>Xem chi tiết: <a href="{{resultUrl}}">{{resultUrl}}</a></p>`,
    bodyText: `Xin chào {{candidateName}},\n\nKết quả kỳ thi {{examTitle}}: {{score}} / {{maxScore}}\nXem chi tiết: {{resultUrl}}`,
  },
  "exam.deadline_reminder": {
    subject: "Nhắc lịch: {{examTitle}} mở thi sau {{hoursUntilOpen}} giờ",
    bodyHtml: `<p>Xin chào {{candidateName}},</p><p>Kỳ thi <strong>{{examTitle}}</strong> sẽ mở vào <strong>{{examOpensAt}}</strong> (còn {{hoursUntilOpen}} giờ nữa).</p><p>Mã dự thi: <strong>{{accessCode}}</strong></p><p>Vào thi: <a href="{{claimUrl}}">{{claimUrl}}</a></p>`,
    bodyText: `Xin chào {{candidateName}},\n\nKỳ thi {{examTitle}} sẽ mở vào {{examOpensAt}} (còn {{hoursUntilOpen}} giờ).\nMã dự thi: {{accessCode}}\nLink: {{claimUrl}}`,
  },
  "gamification.level_up": {
    subject: "🎉 Chúc mừng! Bạn vừa đạt cấp {{newLevel}}",
    bodyHtml: `<p>Xin chào {{learnerName}},</p><p>Chúc mừng bạn vừa đạt <strong>Cấp {{newLevel}}</strong> — {{levelTitle}}!</p><p>Tổng XP: <strong>{{totalXp}}</strong></p><p>Xem hồ sơ: <a href="{{profileUrl}}">{{profileUrl}}</a></p>`,
    bodyText: `Chúc mừng {{learnerName}}!\n\nBạn vừa đạt Cấp {{newLevel}} - {{levelTitle}}.\nTổng XP: {{totalXp}}\nHồ sơ: {{profileUrl}}`,
  },
  "gamification.badge_earned": {
    subject: "🏆 Bạn vừa nhận huy hiệu: {{badgeName}}",
    bodyHtml: `<p>Xin chào {{learnerName}},</p><p>Bạn vừa nhận được huy hiệu <strong>{{badgeName}}</strong>!</p><p>{{badgeDescription}}</p><p>Xem huy hiệu: <a href="{{badgesUrl}}">{{badgesUrl}}</a></p>`,
    bodyText: `Xin chào {{learnerName}},\n\nBạn vừa nhận huy hiệu: {{badgeName}}\n{{badgeDescription}}\n\nXem tại: {{badgesUrl}}`,
  },
  "notification.weekly_digest": {
    subject: "Tóm tắt tuần qua trên Limio.vn",
    bodyHtml: `<p>Xin chào {{learnerName}},</p><p>Tuần này bạn đã hoàn thành <strong>{{lessonsCompleted}}</strong> bài học, làm <strong>{{quizzesTaken}}</strong> quiz, kiếm <strong>{{xpEarned}} XP</strong> và duy trì streak <strong>{{streakDays}} ngày</strong>.</p><p><a href="{{dashboardUrl}}">Vào học ngay</a></p>`,
    bodyText: `Xin chào {{learnerName}},\n\nTuần này: {{lessonsCompleted}} bài học, {{quizzesTaken}} quiz, {{xpEarned}} XP, streak {{streakDays}} ngày.\nVào học: {{dashboardUrl}}`,
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
    const inner = renderField(loaded.bodyHtml, vars);
    const text = loaded.bodyText ? renderField(loaded.bodyText, vars) : stripHtml(inner);
    const subject = renderField(loaded.subject, vars);
    return { subject, html: frame(inner, subject, text), text, source: loaded.source };
  }

  const fb = FALLBACKS[input.key];
  if (!fb) {
    throw new Error(
      `No template found for key=${input.key} (no DB row + no hard-coded fallback)`,
    );
  }
  const subject = renderField(fb.subject, vars);
  const text = renderField(fb.bodyText, vars);
  return {
    subject,
    html: frame(renderField(fb.bodyHtml, vars), subject, text),
    text,
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
  // sendEmail không bao giờ throw — lỗi provider (rate limit, domain chưa verify,
  // mất mạng) chỉ nằm trong SendResult. Nhiều caller không đọc nó, nên ghi log tập
  // trung ở đây để thất bại không còn im lặng.
  if (!result.delivered && !result.loggedOnly) {
    console.error(
      `[email:send_failed] key=${input.key} to=${maskEmail(input.to)} source=${rendered.source} error=${JSON.stringify(result.error ?? "unknown")}`,
    );
  }
  return { ...result, source: rendered.source };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Bọc nội dung vào khung thương hiệu; bỏ qua nếu đã là tài liệu HTML hoàn chỉnh. */
function frame(inner: string, subject: string, text: string): string {
  if (/<html[\s>]/i.test(inner)) return inner;
  const preheader = text.replace(/\s+/g, " ").trim().slice(0, 110);
  return wrapEmail({ bodyHtml: inner, subject, preheader });
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

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
