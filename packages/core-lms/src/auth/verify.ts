import { prisma } from "@feedbackme/db";
import { consumeToken, findValidToken, type DbClient } from "./tokens";

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
