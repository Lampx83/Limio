/**
 * Auth-flow URL builders. Real email sending lives in `../email/templates.ts`
 * (admin-editable templates + Resend wrapper).
 */

export function buildVerificationUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/verify?token=${encodeURIComponent(token)}`;
}

export function buildResetUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/reset?token=${encodeURIComponent(token)}`;
}
