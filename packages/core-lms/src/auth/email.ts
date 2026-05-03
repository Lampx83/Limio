// Phase 0: dev-only email "delivery" — log to console.
// Real email goes through A10 in Phase 1+.

export interface DevEmail {
  to: string;
  subject: string;
  body: string;
}

export function sendDevEmail(email: DevEmail): void {
  /* eslint-disable no-console */
  console.log("\n============== DEV EMAIL ==============");
  console.log("To:", email.to);
  console.log("Subject:", email.subject);
  console.log(email.body);
  console.log("=======================================\n");
  /* eslint-enable no-console */
}

export function buildVerificationUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/verify?token=${encodeURIComponent(token)}`;
}

export function buildResetUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/reset?token=${encodeURIComponent(token)}`;
}
