/**
 * Resend wrapper. Single transactional endpoint.
 *
 * Configured via `RESEND_API_KEY` + `EMAIL_FROM`. When either is unset,
 * falls back to console.log so dev/test still exercises wiring without
 * burning quota. Only call from server contexts.
 */

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

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
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
    if (r.error) {
      return {
        delivered: false,
        providerId: null,
        loggedOnly: false,
        error: r.error.message,
      };
    }
    return { delivered: true, providerId: r.data?.id ?? null, loggedOnly: false };
  } catch (e) {
    return {
      delivered: false,
      providerId: null,
      loggedOnly: false,
      error: (e as Error).message,
    };
  }
}
