import crypto from "node:crypto";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "./roles";
import { logAudit } from "./audit";
import type { DbClient } from "./tokens";

export const IMPERSONATION_COOKIE = "fbm-impersonate";
const TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export class ImpersonationError extends Error {
  constructor(
    public readonly code:
      | "not_admin"
      | "target_not_found"
      | "self_impersonation"
      | "missing_secret",
  ) {
    super(code);
  }
}

function getSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new ImpersonationError("missing_secret");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

/**
 * Cookie format: `<adminId>.<targetId>.<expiryMs>.<hmac>` — opaque to client.
 * Verified server-side only; cookie is HTTP-only so JS cannot read it.
 */
export function buildImpersonationCookie(adminId: string, targetId: string): {
  value: string;
  expires: Date;
} {
  const expiryMs = Date.now() + TTL_MS;
  const payload = `${adminId}.${targetId}.${expiryMs}`;
  const sig = sign(payload);
  return {
    value: `${payload}.${sig}`,
    expires: new Date(expiryMs),
  };
}

export interface DecodedImpersonation {
  adminId: string;
  targetId: string;
  expiresAt: Date;
}

export function decodeImpersonationCookie(
  cookieValue: string | undefined | null,
): DecodedImpersonation | null {
  if (!cookieValue) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 4) return null;
  const [adminId, targetId, expiryStr, sig] = parts;
  if (!adminId || !targetId || !expiryStr || !sig) return null;
  const expected = sign(`${adminId}.${targetId}.${expiryStr}`);
  // timingSafeEqual requires equal-length buffers
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  const expiryMs = Number(expiryStr);
  if (!Number.isFinite(expiryMs) || expiryMs < Date.now()) return null;
  return { adminId, targetId, expiresAt: new Date(expiryMs) };
}

/**
 * Authorize and record an impersonation. Returns the cookie payload to set;
 * caller is responsible for actually setting the cookie on the response.
 */
export async function startImpersonation(
  adminId: string,
  targetUserId: string,
  db: DbClient = prisma,
): Promise<{ value: string; expires: Date }> {
  if (!(await isAdmin(adminId, db))) {
    throw new ImpersonationError("not_admin");
  }
  if (adminId === targetUserId) {
    throw new ImpersonationError("self_impersonation");
  }
  const target = await db.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true },
  });
  if (!target) throw new ImpersonationError("target_not_found");

  await logAudit(
    {
      action: "impersonation.started",
      actorUserId: adminId,
      targetUserId,
      payload: { targetEmail: target.email },
    },
    db,
  );

  return buildImpersonationCookie(adminId, targetUserId);
}

export async function stopImpersonation(
  adminId: string,
  targetId: string,
  db: DbClient = prisma,
): Promise<void> {
  await logAudit(
    {
      action: "impersonation.stopped",
      actorUserId: adminId,
      targetUserId: targetId,
      payload: {},
    },
    db,
  );
}
