import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { logAudit } from "./audit";
import type { DbClient } from "./tokens";

export const ChangePasswordInput = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;

const BCRYPT_COST = 12;

export class ChangePasswordError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "user_not_found"
      | "no_password_set"
      | "current_password_incorrect"
      | "same_as_current",
  ) {
    super(code);
  }
}

/**
 * Authenticated password change: verifies the current password before
 * setting a new one. Emits an audit log entry on success.
 *
 * SSO-only users (no password provider) cannot use this endpoint —
 * they must go through the forgot-password reset flow to set an initial
 * password (or we could add a "set password" flow separately later).
 */
export async function changePassword(
  userId: string,
  rawInput: unknown,
  db: DbClient = prisma,
): Promise<void> {
  const parsed = ChangePasswordInput.safeParse(rawInput);
  if (!parsed.success) throw new ChangePasswordError("validation_failed");
  const { currentPassword, newPassword } = parsed.data;

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { authProviders: true },
  });
  if (!user) throw new ChangePasswordError("user_not_found");
  if (!user.passwordHash) throw new ChangePasswordError("no_password_set");

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new ChangePasswordError("current_password_incorrect");

  // Reject no-op changes — saves a hash and is what a user expects.
  const sameAsOld = await bcrypt.compare(newPassword, user.passwordHash);
  if (sameAsOld) throw new ChangePasswordError("same_as_current");

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await db.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  // Ensure a password AuthProvider row exists (safety net — should already
  // be true if user had a passwordHash, but harmless to upsert).
  const hasPasswordProvider = user.authProviders.some(
    (p) => p.provider === "password",
  );
  if (!hasPasswordProvider) {
    await db.authProvider.create({
      data: {
        userId,
        provider: "password",
        providerUserId: user.email,
      },
    });
  }

  await logAudit(
    {
      action: "user.password.changed",
      actorUserId: userId,
      targetUserId: userId,
      payload: {},
    },
    db,
  );
}
