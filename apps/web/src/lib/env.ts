import { z } from "zod";

/**
 * Validate process.env at boot. Fail fast on missing required vars in prod;
 * warn-only in dev. Import this once from the root layout / next.config.
 */
const Schema = z.object({
  // Required everywhere.
  DATABASE_URL: z.string().url().startsWith("postgres"),
  NEXTAUTH_SECRET: z.string().min(16),

  // Optional — features degrade if missing.
  OPENAI_API_KEY: z.string().optional(),
  SECRETS_MASTER_KEY: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SCORM_STORAGE_ROOT: z.string().optional(),
  H5P_STORAGE_ROOT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  LTI_PLATFORM_ISSUER: z.string().url().optional(),
  // Origin công khai cho canonical/sitemap/OG. Bỏ trống → lib/seo.ts lấy NEXTAUTH_URL.
  SITE_URL: z.string().url().optional(),
  AI_TURNS_PER_HOUR: z.string().optional(),
  AI_TOKENS_PER_DAY: z.string().optional(),
  // A5.8 Q3 — Email service for sending exam codes to assigned candidates.
  // If RESEND_API_KEY is unset, lib/email.ts falls back to console.log so
  // dev/test still flow without burning the Resend quota.
  RESEND_API_KEY: z.string().optional(),
  // Hoặc SMTP tự host (ưu tiên hơn Resend khi SMTP_HOST được đặt).
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_IGNORE_TLS: z.string().optional(),
  // Chấp nhận cả dạng `Limio <no-reply@limio.vn>`.
  EMAIL_FROM: z.string().optional(),
  // Google Analytics 4 Measurement ID (dạng G-XXXXXXXXXX). Bỏ trống → không
  // load script GA, không cần trong dev/test.
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type AppEnv = z.infer<typeof Schema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = Schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = `Invalid environment: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`;
    if (process.env.NODE_ENV === "production") {
      throw new Error(msg);
    }
    // Dev: warn loudly, but allow boot so first-run is friendlier.
    console.warn(`[env] ${msg}`);
  }
  cached = (parsed.success ? parsed.data : (process.env as unknown as AppEnv));
  return cached;
}

/** Bool helper: returns true if value is set + non-empty. */
export function hasEnv(key: keyof AppEnv): boolean {
  return Boolean(process.env[key as string]);
}
