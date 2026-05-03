import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // Strip PII automatically. Don't send IPs / cookies.
    sendDefaultPii: false,
    // Filter out expected errors that aren't actionable.
    ignoreErrors: [
      "validation_failed",
      "not_enrolled",
      "forbidden",
      "unauthorized",
    ],
  });
}
