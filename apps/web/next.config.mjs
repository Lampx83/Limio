import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

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
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
    outputFileTracingRoot: resolve(__dirname, "../../"),
    // NOTE: outputFileTracingIncludes is intentionally omitted.
    // A glob over node_modules/**  in a pnpm workspace (with its large
    // virtual store) exhausts the Node.js heap during "Collecting build
    // traces".  The Prisma query engine binary is instead copied into the
    // image explicitly by the `prisma-engine` stage in the Dockerfile.
  },
};

export default nextConfig;
