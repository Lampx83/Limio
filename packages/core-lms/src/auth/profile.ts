import { z } from "zod";
import { prisma } from "@feedbackme/db";
import type { DbClient } from "./tokens";

export const ProfileUpdateInput = z.object({
  displayName: z.string().min(1).max(80).trim().optional(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
  locale: z.string().min(2).max(10).optional(),
  timezone: z.string().min(1).max(64).optional(),
  // Phase 1 C5 — opt out of public course leaderboards (spec §5.5).
  leaderboardOptOut: z.boolean().optional(),
});

export class ProfileError extends Error {
  constructor(public readonly code: "validation_failed") {
    super(code);
  }
}

export async function updateProfile(
  userId: string,
  rawInput: unknown,
  db: DbClient = prisma,
): Promise<void> {
  const parsed = ProfileUpdateInput.safeParse(rawInput);
  if (!parsed.success) throw new ProfileError("validation_failed");

  // Drop undefined keys so unspecified fields don't get reset to null.
  const data = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(data).length === 0) return;

  await db.user.update({ where: { id: userId }, data });
}

/** Foundational GDPR export — all data tied to the user, in JSON. Never includes passwordHash. */
export async function exportProfile(userId: string, db: DbClient = prisma) {
  return db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      displayName: true,
      avatarUrl: true,
      locale: true,
      timezone: true,
      createdAt: true,
      updatedAt: true,
      authProviders: { select: { id: true, provider: true, createdAt: true } },
      userRoles: {
        select: {
          id: true,
          courseId: true,
          grantedAt: true,
          role: { select: { name: true } },
        },
      },
      enrollments: true,
      verificationTokens: { select: { id: true, purpose: true, createdAt: true, consumedAt: true } },
    },
  });
}
