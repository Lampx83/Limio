/**
 * Generic "find user by email, or create pending account + send invite email".
 * Extracted from inviteUserAsProctor (exam-rounds.ts) so other features
 * (cohort instructor, course co-teacher, …) can reuse the flow.
 *
 * Uses admin-editable email templates (see packages/core-lms/src/email).
 * Caller passes a `templateKey` + optional `organizationId` so the
 * org-specific override (if any) is picked up.
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { issueToken } from "./tokens";
import { buildResetUrl } from "./email";
import { sendTemplatedEmail, type TemplateKey } from "../email/templates";

export interface InviteResult {
  userId: string;
  invited: boolean; // true = new account created + email sent
  resetUrl?: string;
}

export interface InviteOptions {
  email: string;
  displayName: string;
  baseUrl: string;
  templateKey: TemplateKey;
  /** Used to pick per-org template override. null = global default. */
  organizationId?: string | null;
  /** Extra Handlebars variables on top of `{ name, resetUrl }`. */
  extraVariables?: Record<string, string | number | null | undefined>;
  db?: PrismaClient;
}

/**
 * Find user by email (case-insensitive). If exists, return as-is. If not,
 * create a Learner with no password + issue reset token + send invite email
 * with a password-set link. Email is implicitly verified since they were
 * invited by an authenticated instructor.
 */
export async function findOrInviteUserByEmail(
  opts: InviteOptions,
): Promise<InviteResult> {
  const db = opts.db ?? prisma;
  const email = opts.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("invalid_email");
  const name = opts.displayName.trim() || email.split("@")[0]!;

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) return { userId: existing.id, invited: false };

  const learnerRole = await db.role.findUniqueOrThrow({
    where: { name: RoleName.Learner },
  });

  const { userId, raw } = await (db as typeof prisma).$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        displayName: name,
        // Inherit organization from the inviting context so the invitee
        // shows up under the right tenant immediately.
        organizationId: opts.organizationId ?? null,
        locale: "vi",
        timezone: "Asia/Ho_Chi_Minh",
        emailVerifiedAt: new Date(),
      },
    });
    await tx.authProvider.create({
      data: { userId: user.id, provider: "password", providerUserId: email },
    });
    await tx.userRole.create({
      data: { userId: user.id, roleId: learnerRole.id },
    });
    const issued = await issueToken(user.id, "password_reset", tx);
    return { userId: user.id, raw: issued.raw };
  });

  const resetUrl = buildResetUrl(opts.baseUrl, raw);
  await sendTemplatedEmail({
    key: opts.templateKey,
    to: email,
    organizationId: opts.organizationId ?? null,
    variables: { name, resetUrl, ...(opts.extraVariables ?? {}) },
  });

  return { userId, invited: true, resetUrl };
}
