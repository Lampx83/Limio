import { randomBytes, createHash } from "node:crypto";
import { prisma, type Prisma, type PrismaClient, type TokenPurpose } from "@feedbackme/db";

const TOKEN_BYTES = 32;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

export type DbClient = PrismaClient | Prisma.TransactionClient;

export function generateRawToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function ttlForPurpose(purpose: TokenPurpose): number {
  return purpose === "email_verify" ? VERIFY_TTL_MS : RESET_TTL_MS;
}

export interface IssuedToken {
  raw: string;
  expiresAt: Date;
}

/** Mint and persist a token for a user. Returns the raw token (only time it exists in plain). */
export async function issueToken(
  userId: string,
  purpose: TokenPurpose,
  db: DbClient = prisma,
): Promise<IssuedToken> {
  const raw = generateRawToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + ttlForPurpose(purpose));
  await db.verificationToken.create({
    data: { userId, purpose, tokenHash, expiresAt },
  });
  return { raw, expiresAt };
}

/** Look up a token by raw value. Returns null if not found, expired, or already consumed. */
export async function findValidToken(
  raw: string,
  purpose: TokenPurpose,
  db: DbClient = prisma,
) {
  const tokenHash = hashToken(raw);
  const token = await db.verificationToken.findUnique({ where: { tokenHash } });
  if (!token) return null;
  if (token.purpose !== purpose) return null;
  if (token.consumedAt !== null) return null;
  if (token.expiresAt.getTime() < Date.now()) return null;
  return token;
}

/** Mark token consumed atomically. Returns true if successfully consumed (i.e. caller wins the race). */
export async function consumeToken(
  tokenId: string,
  db: DbClient = prisma,
): Promise<boolean> {
  const result = await db.verificationToken.updateMany({
    where: { id: tokenId, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  return result.count === 1;
}

/** Invalidate any outstanding tokens of a given purpose for a user (used after successful reset). */
export async function invalidateOutstandingTokens(
  userId: string,
  purpose: TokenPurpose,
  db: DbClient = prisma,
): Promise<void> {
  await db.verificationToken.updateMany({
    where: { userId, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });
}
