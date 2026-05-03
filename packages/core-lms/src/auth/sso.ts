import { prisma } from "@feedbackme/db";
import type { DbClient } from "./tokens";

/**
 * Find-or-create user from a verified OAuth/OIDC sign-in.
 *
 * Account linking strategy:
 * 1. If an AuthProvider row exists for (provider, providerUserId) — use it
 *    (return the linked user).
 * 2. Else if a user with this email already exists — link it (insert AuthProvider
 *    row pointing to the existing user). Marks email as verified since the
 *    provider already verified it.
 * 3. Else create a new user + AuthProvider row.
 *
 * Important: only call this with `emailVerifiedByProvider: true` when the
 * upstream IdP guarantees email ownership (Google + Microsoft do; some
 * generic OIDC providers don't — caller's responsibility to pass false).
 */
export async function loginOrLinkSso(
  input: {
    provider: "google" | "microsoft";
    providerUserId: string;
    email: string;
    name: string;
    emailVerifiedByProvider: boolean;
  },
  db: DbClient = prisma,
) {
  const email = input.email.trim().toLowerCase();
  if (!email) return null;

  // Step 1: existing AuthProvider link.
  const link = await db.authProvider.findUnique({
    where: {
      provider_providerUserId: {
        provider: input.provider,
        providerUserId: input.providerUserId,
      },
    },
    include: { user: true },
  });
  if (link) {
    return {
      id: link.user.id,
      email: link.user.email,
      name: link.user.displayName,
      isEmailVerified: link.user.emailVerifiedAt !== null,
    };
  }

  // Step 2 / 3 — find by email or create.
  const existing = await db.user.findUnique({ where: { email } });

  if (existing) {
    // Link new provider to existing account.
    await db.authProvider.create({
      data: {
        userId: existing.id,
        provider: input.provider,
        providerUserId: input.providerUserId,
      },
    });
    // Mark email verified if provider asserts it and we haven't yet.
    if (input.emailVerifiedByProvider && !existing.emailVerifiedAt) {
      await db.user.update({
        where: { id: existing.id },
        data: { emailVerifiedAt: new Date() },
      });
    }
    return {
      id: existing.id,
      email: existing.email,
      name: existing.displayName,
      isEmailVerified: true,
    };
  }

  // Step 3: create new user.
  const created = await db.user.create({
    data: {
      email,
      displayName: input.name || email.split("@")[0]!,
      emailVerifiedAt: input.emailVerifiedByProvider ? new Date() : null,
      authProviders: {
        create: {
          provider: input.provider,
          providerUserId: input.providerUserId,
        },
      },
    },
  });
  return {
    id: created.id,
    email: created.email,
    name: created.displayName,
    isEmailVerified: created.emailVerifiedAt !== null,
  };
}
