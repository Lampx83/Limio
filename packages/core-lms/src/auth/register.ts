import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { issueToken } from "./tokens";
import { buildVerificationUrl } from "./email";
import { sendTemplatedEmail } from "../email/templates";

export const RegisterInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(80).trim(),
  locale: z.string().min(2).max(10).optional(),
  timezone: z.string().min(1).max(64).optional(),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export interface RegisterResult {
  userId: string;
  email: string;
  displayName: string;
  verificationUrl: string;
}

// Mặc định 12 (~350ms/hash, bcryptjs thuần JS). Vitest đặt BCRYPT_COST=4 vì test
// tạo hàng trăm user; production không set biến này nên luôn dùng 12.
const bcryptCost = () => Number(process.env.BCRYPT_COST) || 12;

export class RegisterError extends Error {
  constructor(public readonly code: "email_taken" | "validation_failed", message: string) {
    super(message);
  }
}

/**
 * Create a new learner account, issue an email-verification token, and "send" the link.
 * Returns the verification URL (so the API route can log it / show it in dev).
 */
export async function registerUser(
  rawInput: unknown,
  baseUrl: string,
  db: PrismaClient = prisma,
): Promise<RegisterResult> {
  const parsed = RegisterInput.safeParse(rawInput);
  if (!parsed.success) {
    throw new RegisterError("validation_failed", parsed.error.message);
  }
  const input = parsed.data;

  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new RegisterError("email_taken", "Email đã được đăng ký");
  }

  const passwordHash = await bcrypt.hash(input.password, bcryptCost());
  const learnerRole = await db.role.findUniqueOrThrow({ where: { name: RoleName.Learner } });

  const { userId, raw } = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        locale: input.locale ?? "vi",
        timezone: input.timezone ?? "Asia/Ho_Chi_Minh",
      },
    });
    await tx.authProvider.create({
      data: {
        userId: user.id,
        provider: "password",
        providerUserId: input.email,
      },
    });
    await tx.userRole.create({
      data: { userId: user.id, roleId: learnerRole.id },
    });
    const issued = await issueToken(user.id, "email_verify", tx);
    return { userId: user.id, raw: issued.raw };
  });

  const verificationUrl = buildVerificationUrl(baseUrl, raw);
  // Self-registration: user not tied to an org yet → use global template.
  await sendTemplatedEmail({
    key: "auth.verify_email",
    to: input.email,
    organizationId: null,
    variables: { displayName: input.displayName, verificationUrl },
  });

  return {
    userId,
    email: input.email,
    displayName: input.displayName,
    verificationUrl,
  };
}
