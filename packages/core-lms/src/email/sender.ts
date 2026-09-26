/**
 * Resend wrapper. Single transactional endpoint.
 *
 * Configured via `RESEND_API_KEY` + `EMAIL_FROM`. When either is unset,
 * falls back to console.log so dev/test still exercises wiring without
 * burning quota. Only call from server contexts.
 */

import { prisma } from "@feedbackme/db";
import { Resend } from "resend";

export type SendResult = {
  delivered: boolean;
  providerId: string | null;
  // True when call was a no-op fallback (no Resend key configured).
  loggedOnly: boolean;
  error?: string;
};

let cachedClient: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cachedClient) cachedClient = new Resend(key);
  return cachedClient;
}

/**
 * Ghi 1 dòng nhật ký cho lần gọi provider (để admin xem số email trong ngày).
 * Best-effort: không bao giờ throw, không chờ — log hỏng không được làm hỏng việc gửi.
 */
function recordSend(input: { to: string; templateKey?: string }, r: SendResult): void {
  const at = input.to.lastIndexOf("@");
  void prisma.emailSendLog
    .create({
      data: {
        templateKey: input.templateKey ?? null,
        toDomain: at >= 0 ? input.to.slice(at + 1).toLowerCase().slice(0, 253) : "?",
        status: r.delivered ? "sent" : "failed",
        providerId: r.providerId,
        error: r.error ? r.error.slice(0, 500) : null,
      },
    })
    .catch(() => {});
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Khoá template gốc, chỉ để thống kê (không ảnh hưởng nội dung). */
  templateKey?: string;
}): Promise<SendResult> {
  const from = process.env.EMAIL_FROM;
  const client = getClient();

  if (!client || !from) {
    // eslint-disable-next-line no-console
    console.log(
      `[email:dev-noop] to=${input.to} subject=${JSON.stringify(input.subject)} ` +
        `${input.text ? "text=" + JSON.stringify(input.text.slice(0, 200)) : ""}`,
    );
    return { delivered: false, providerId: null, loggedOnly: true };
  }

  try {
    const r = await client.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    const res: SendResult = r.error
      ? { delivered: false, providerId: null, loggedOnly: false, error: r.error.message }
      : { delivered: true, providerId: r.data?.id ?? null, loggedOnly: false };
    recordSend(input, res);
    return res;
  } catch (e) {
    const res: SendResult = {
      delivered: false,
      providerId: null,
      loggedOnly: false,
      error: (e as Error).message,
    };
    recordSend(input, res);
    return res;
  }
}
