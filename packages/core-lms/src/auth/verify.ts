import { prisma } from "@feedbackme/db";
import {
  consumeToken,
  findValidToken,
  invalidateOutstandingTokens,
  issueToken,
  type DbClient,
} from "./tokens";
import { buildVerificationUrl } from "./email";
import { sendTemplatedEmail } from "../email/templates";
import { logAudit } from "./audit";

export class VerifyError extends Error {
  constructor(public readonly code: "invalid_or_expired_token" | "already_verified") {
    super(code);
  }
}

export interface VerifyResult {
  userId: string;
  email: string;
}

export async function verifyEmail(
  rawToken: string,
  db: DbClient = prisma,
): Promise<VerifyResult> {
  const token = await findValidToken(rawToken, "email_verify", db);
  if (!token) throw new VerifyError("invalid_or_expired_token");

  const user = await db.user.findUniqueOrThrow({ where: { id: token.userId } });
  if (user.emailVerifiedAt) {
    // Token was still unconsumed (race), but verify is idempotent. Burn the token.
    await consumeToken(token.id, db);
    return { userId: user.id, email: user.email };
  }

  const won = await consumeToken(token.id, db);
  if (!won) {
    // Lost a race with another request consuming the same token.
    throw new VerifyError("invalid_or_expired_token");
  }
  await db.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date() },
  });
  return { userId: user.id, email: user.email };
}

export class ResendVerificationError extends Error {
  constructor(public readonly code: "user_not_found" | "already_verified") {
    super(code);
  }
}

/** Admin-triggered resend: burns any outstanding token and mints + sends a fresh one. */
export async function resendVerificationEmail(
  actorUserId: string,
  targetUserId: string,
  baseUrl: string,
  db: DbClient = prisma,
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      email: true,
      displayName: true,
      organizationId: true,
      emailVerifiedAt: true,
    },
  });
  if (!user) throw new ResendVerificationError("user_not_found");
  if (user.emailVerifiedAt) throw new ResendVerificationError("already_verified");

  await invalidateOutstandingTokens(user.id, "email_verify", db);
  const issued = await issueToken(user.id, "email_verify", db);
  const verificationUrl = buildVerificationUrl(baseUrl, issued.raw);
  await sendTemplatedEmail({
    key: "auth.verify_email",
    to: user.email,
    organizationId: user.organizationId,
    variables: { displayName: user.displayName, verificationUrl },
  });

  await logAudit(
    { action: "user.verification_email_resent", actorUserId, targetUserId, payload: {} },
    db,
  );
}
