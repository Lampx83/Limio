/**
 * Backwards-compat shim. The real implementation lives in
 * `@feedbackme/core-lms/email` (see packages/core-lms/src/email/).
 *
 * Kept so existing imports (`@/lib/email`) keep working. The exam code
 * preview at /api/debug/email-preview still uses `renderExamCodeEmail`
 * here to render a deterministic HTML preview without a DB lookup.
 */

export { sendEmail, type SendResult } from "@feedbackme/core-lms";

/** Deterministic HTML preview used by the email-preview debug route. */
export function renderExamCodeEmail(input: {
  candidateName: string;
  examTitle: string;
  examOpensAt: Date;
  examClosesAt: Date;
  examDurationMin: number;
  accessCode: string;
  claimUrl: string;
}): { subject: string; html: string; text: string } {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(d);

  const subject = `[${input.examTitle}] Mã dự thi của bạn`;

  const html = `<!doctype html>
<html lang="vi">
  <body style="font-family: -apple-system, system-ui, sans-serif; line-height: 1.5; color: #1e293b; margin: 0; padding: 24px; background: #f8fafc;">
    <table cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; background: white; border-radius: 8px; padding: 32px; border: 1px solid #e2e8f0;">
      <tr><td>
        <h1 style="margin: 0 0 8px; font-size: 20px;">Mã dự thi</h1>
        <p style="margin: 0 0 24px; color: #64748b; font-size: 14px;">
          Xin chào ${escapeHtml(input.candidateName)}, dưới đây là mã dự thi của bạn cho kỳ thi
          <strong>${escapeHtml(input.examTitle)}</strong>.
        </p>
        <div style="background: #f1f5f9; border-radius: 6px; padding: 20px; text-align: center; margin: 24px 0;">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em;">Mã dự thi</div>
          <div style="font-family: ui-monospace, monospace; font-size: 32px; letter-spacing: 0.3em; color: #0f172a; margin-top: 8px;">${escapeHtml(input.accessCode)}</div>
        </div>
        <table cellpadding="6" cellspacing="0" style="width: 100%; font-size: 14px; margin: 16px 0;">
          <tr><td style="color: #64748b;">Thời gian mở:</td><td><strong>${fmt(input.examOpensAt)}</strong></td></tr>
          <tr><td style="color: #64748b;">Thời gian đóng:</td><td><strong>${fmt(input.examClosesAt)}</strong></td></tr>
          <tr><td style="color: #64748b;">Thời lượng:</td><td><strong>${input.examDurationMin} phút</strong></td></tr>
        </table>
        <p style="margin: 24px 0 8px;">Bấm nút bên dưới để bắt đầu thi:</p>
        <a href="${escapeHtml(input.claimUrl)}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">Vào thi</a>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = [
    `Mã dự thi cho ${input.examTitle}`,
    ``,
    `Xin chào ${input.candidateName},`,
    ``,
    `Mã dự thi: ${input.accessCode}`,
    `Thời gian mở: ${fmt(input.examOpensAt)}`,
    `Thời gian đóng: ${fmt(input.examClosesAt)}`,
    `Thời lượng: ${input.examDurationMin} phút`,
    ``,
    `Vào thi: ${input.claimUrl}`,
  ].join("\n");

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
