import * as Sentry from "@sentry/nextjs";

/**
 * Next.js instrumentation hook — chạy 1 lần khi server khởi động, trước mọi
 * request. Nạp Sentry config đúng runtime. Không có SENTRY_DSN thì các file
 * config không init gì cả.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Next ≥ 15 gọi hook này cho lỗi trong server component / route handler /
// middleware. Next 14 bỏ qua — ở đó withSentryConfig tự bọc route handler.
export const onRequestError = Sentry.captureRequestError;
