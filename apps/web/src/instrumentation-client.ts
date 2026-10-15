import * as Sentry from "@sentry/nextjs";

// Client-side Sentry. withSentryConfig (next.config.mjs) inject file này vào
// bundle trình duyệt. NEXT_PUBLIC_SENTRY_DSN được inline LÚC BUILD — thiếu thì
// không init, không gửi gì.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    sendDefaultPii: false,
  });
}

// Next ≥ 15.3 gọi hook này khi điều hướng; Next 14 bỏ qua.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
