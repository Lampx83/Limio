/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@feedbackme/core-lms",
    "@feedbackme/core-feedback",
    "@feedbackme/core-gamification",
    "@feedbackme/db",
    "@feedbackme/shared-types",
  ],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
};

export default nextConfig;
