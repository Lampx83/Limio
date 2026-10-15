import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { withSentryConfig } from "@sentry/nextjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Sub-path prefix when served behind a reverse proxy (e.g. /limio).
  // Baked in at build time via Docker build-arg NEXT_PUBLIC_BASE_PATH.
  // Leave empty ("") to serve from the domain root.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  transpilePackages: [
    "@feedbackme/core-lms",
    "@feedbackme/core-feedback",
    "@feedbackme/core-gamification",
    "@feedbackme/db",
    "@feedbackme/shared-types",
  ],
  // Bản web trình chiếu giới thiệu hệ thống: file tĩnh ở public/gioi-thieu/.
  // Next không tự map thư mục → index.html nên rewrite tường minh.
  async rewrites() {
    return {
      beforeFiles: [{ source: "/gioi-thieu", destination: "/gioi-thieu/index.html" }],
    };
  },
  experimental: {
    // Next 14 chỉ nạp src/instrumentation.ts (khởi tạo Sentry server/edge) khi
    // bật cờ này. withSentryConfig cũng tự bật, ghi rõ để khỏi phụ thuộc ngầm.
    instrumentationHook: true,
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs", "sharp"],
    outputFileTracingRoot: resolve(__dirname, "../../"),
    // NOTE: outputFileTracingIncludes is intentionally omitted.
    // A glob over node_modules/**  in a pnpm workspace (with its large
    // virtual store) exhausts the Node.js heap during "Collecting build
    // traces".  The Prisma query engine binary is instead copied into the
    // image explicitly by the `prisma-engine` stage in the Dockerfile.
  },
};

// Upload source map lên Sentry chỉ khi có SENTRY_AUTH_TOKEN (+ SENTRY_ORG /
// SENTRY_PROJECT) lúc build. Thiếu token: không sinh/upload source map, không
// tạo release — build phải chạy bình thường. Thiếu DSN cũng không sao: các file
// sentry.*.config / instrumentation-client chỉ init khi có DSN lúc chạy.
const hasSentryAuthToken = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: { disable: !hasSentryAuthToken },
  release: { create: hasSentryAuthToken, finalize: hasSentryAuthToken },
  // Lỗi của plugin (mạng, token sai...) chỉ cảnh báo, không làm fail build.
  errorHandler: (err) => {
    console.warn("[sentry] build plugin error (ignored):", err.message);
  },
});
