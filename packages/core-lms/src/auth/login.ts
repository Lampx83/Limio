import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import type { DbClient } from "./tokens";

export const LoginInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof LoginInput>;

export interface LoginResult {
  id: string;
  email: string;
  name: string;
  isEmailVerified: boolean;
}

/**
 * Verify credentials against the password AuthProvider.
 * Returns the user info on success, null on failure (wrong email, wrong password,
 * or no password provider linked — e.g. Google-only user).
 */
export async function loginCredentials(
  rawInput: unknown,
  db: DbClient = prisma,
): Promise<LoginResult | null> {
  const parsed = LoginInput.safeParse(rawInput);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({
    where: { email },
    include: { authProviders: true },
  });
  if (!user || !user.passwordHash) return null;

  const hasPasswordProvider = user.authProviders.some((p) => p.provider === "password");
  if (!hasPasswordProvider) return null;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.displayName,
    isEmailVerified: user.emailVerifiedAt !== null,
  };
}
