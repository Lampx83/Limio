import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";

export class IntegrationError extends Error {
  constructor(
    public readonly code:
      | "master_key_missing"
      | "master_key_invalid"
      | "decrypt_failed"
      | "key_not_found"
      | "validation_failed",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

/**
 * Resolve the 32-byte master key used to wrap secrets in IntegrationCredential.
 * Accepts either a 64-char hex string or any string (which we then derive into
 * 32 bytes via scrypt). In dev we allow a fallback so `pnpm dev` works without
 * extra setup; in prod always set the env var.
 */
function getMasterKey(): Buffer {
  const raw = process.env.SECRETS_MASTER_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new IntegrationError("master_key_missing");
    }
    // Dev fallback — derived from a fixed string so encrypted values survive
    // dev-server restarts. NEVER use in prod.
    return scryptSync("feedbackme-dev-master-key-not-for-prod", "fbm-salt", 32);
  }
  // Support hex (64 chars = 32 bytes) or arbitrary passphrase.
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return scryptSync(raw, "fbm-salt", 32);
}

const ALGO = "aes-256-gcm";
const NONCE_LEN = 12;
const TAG_LEN = 16;

export function encryptSecret(plaintext: string): string {
  const key = getMasterKey();
  const nonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv(ALGO, key, nonce);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, enc, tag]).toString("base64");
}

export function decryptSecret(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  if (buf.length < NONCE_LEN + TAG_LEN) {
    throw new IntegrationError("decrypt_failed", "ciphertext_too_short");
  }
  const nonce = buf.subarray(0, NONCE_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const enc = buf.subarray(NONCE_LEN, buf.length - TAG_LEN);
  try {
    const key = getMasterKey();
    const decipher = createDecipheriv(ALGO, key, nonce);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    throw new IntegrationError("decrypt_failed");
  }
}

/** Allowed integration keys. Reject anything else to prevent typos creating orphan rows. */
export const INTEGRATION_KEYS = [
  "openai",
  "stripe.secret",
  "vnpay.secret",
  "momo.secret",
  // A6.6 — Vấn đáp bằng giọng nói. Vbee cần 2 secret (App-Id + Token, lấy ở
  // studio.vbee.vn/apps), khác OpenAI chỉ 1 key — theo đúng quy ước
  // "provider.secretName" đã dùng cho stripe/vnpay/momo ở trên.
  "vbee.app_id",
  "vbee.token",
] as const;
export type IntegrationKey = (typeof INTEGRATION_KEYS)[number];

function assertKey(key: string): asserts key is IntegrationKey {
  if (!(INTEGRATION_KEYS as readonly string[]).includes(key)) {
    throw new IntegrationError("validation_failed", `unknown_key:${key}`);
  }
}

export async function setIntegrationCredential(
  key: string,
  value: string,
  updatedById: string,
  meta: Record<string, unknown> | null = null,
  db: PrismaClient = prisma,
): Promise<void> {
  assertKey(key);
  if (!value || value.length < 5) {
    throw new IntegrationError("validation_failed", "value_too_short");
  }
  const encryptedValue = encryptSecret(value);
  const metaValue = meta
    ? (meta as Prisma.InputJsonValue)
    : Prisma.JsonNull;
  await db.integrationCredential.upsert({
    where: { key },
    create: {
      key,
      encryptedValue,
      meta: metaValue,
      updatedById,
    },
    update: {
      encryptedValue,
      meta: metaValue,
      updatedById,
    },
  });
}

export async function deleteIntegrationCredential(
  key: string,
  db: PrismaClient = prisma,
): Promise<void> {
  assertKey(key);
  await db.integrationCredential.deleteMany({ where: { key } });
}

/** Internal — returns plaintext value. Server-side only. */
export async function getIntegrationSecret(
  key: string,
  db: PrismaClient = prisma,
): Promise<string> {
  assertKey(key);
  const row = await db.integrationCredential.findUnique({ where: { key } });
  if (!row) {
    // Fallback: env var with same uppercased + dotted-to-underscore name.
    // e.g. "openai" → OPENAI_API_KEY; "stripe.secret" → STRIPE_SECRET.
    const envName = envFallbackName(key);
    const envValue = envName ? process.env[envName] : undefined;
    if (envValue) return envValue;
    throw new IntegrationError("key_not_found", key);
  }
  return decryptSecret(row.encryptedValue);
}

function envFallbackName(key: string): string | null {
  switch (key) {
    case "openai":
      return "OPENAI_API_KEY";
    case "stripe.secret":
      return "STRIPE_SECRET";
    case "vnpay.secret":
      return "VNPAY_SECRET";
    case "momo.secret":
      return "MOMO_SECRET";
    default:
      return null;
  }
}

export interface IntegrationStatus {
  key: IntegrationKey;
  hasValue: boolean;
  source: "db" | "env" | "none";
  updatedAt: Date | null;
}

/** Public-safe — never returns the secret itself. */
export async function listIntegrationStatuses(
  db: PrismaClient = prisma,
): Promise<IntegrationStatus[]> {
  const rows = await db.integrationCredential.findMany({
    select: { key: true, updatedAt: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.updatedAt]));
  return INTEGRATION_KEYS.map((key) => {
    const dbAt = byKey.get(key);
    if (dbAt) return { key, hasValue: true, source: "db" as const, updatedAt: dbAt };
    const envName = envFallbackName(key);
    if (envName && process.env[envName]) {
      return { key, hasValue: true, source: "env" as const, updatedAt: null };
    }
    return { key, hasValue: false, source: "none" as const, updatedAt: null };
  });
}

/**
 * Test an OpenAI key by hitting the cheap GET /v1/models endpoint. Returns
 * { ok: true, model_count } or { ok: false, error }.
 */
export async function testOpenAiKey(
  apiKey: string,
): Promise<
  | { ok: true; modelCount: number }
  | { ok: false; error: string }
> {
  if (!apiKey || !apiKey.trim()) return { ok: false, error: "empty_key" };
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      return {
        ok: false,
        error: body.error?.message ?? `http_${res.status}`,
      };
    }
    const json = (await res.json()) as { data?: unknown[] };
    return { ok: true, modelCount: Array.isArray(json.data) ? json.data.length : 0 };
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "unknown_error" };
  }
}
