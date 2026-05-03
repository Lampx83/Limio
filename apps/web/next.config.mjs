import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
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
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
    outputFileTracingRoot: resolve(__dirname, "../../"),
    // Force-include the Prisma query engine binary in the standalone output.
    // Next.js file tracing skips native .node binaries; without this the
    // standalone image throws PrismaClientInitializationError at runtime.
    outputFileTracingIncludes: {
      "/**": [
        "./node_modules/**/.prisma/client/libquery_engine-*.node",
      ],
    },
  },
};

export default nextConfig;
