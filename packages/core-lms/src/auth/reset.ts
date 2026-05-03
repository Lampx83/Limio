import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import {
  consumeToken,
  findValidToken,
  invalidateOutstandingTokens,
  issueToken,
  type DbClient,
} from "./tokens";
import { buildResetUrl, sendDevEmail } from "./email";

export const ResetRequestInput = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const ResetInput = z.object({
  token: z.string().min(8),
  newPassword: z.string().min(8).max(128),
});

const BCRYPT_COST = 12;

/**
 * Always returns silently — never reveals whether the email exists.
 * If the email matches a user, mints a reset token and "sends" it.
 */
export async function requestPasswordReset(
  rawInput: unknown,
  baseUrl: string,
  db: DbClient = prisma,
): Promise<void> {
  const parsed = ResetRequestInput.safeParse(rawInput);
  if (!parsed.success) return;

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return;

  const issued = await issueToken(user.id, "password_reset", db);
  const url = buildResetUrl(baseUrl, issued.raw);
  sendDevEmail({
    to: user.email,
    subject: "Yêu cầu đặt lại mật khẩu cho FeedBackMe",
    body: `Xin chào ${user.displayName},\n\nNhấn link sau để đặt lại mật khẩu (TTL 1h):\n${url}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
  });
}

export class ResetError extends Error {
  constructor(public readonly code: "invalid_or_expired_token" | "validation_failed") {
    super(code);
  }
}

export async function resetPassword(rawInput: unknown, db: DbClient = prisma): Promise<void> {
  const parsed = ResetInput.safeParse(rawInput);
  if (!parsed.success) throw new ResetError("validation_failed");

  const token = await findValidToken(parsed.data.token, "password_reset", db);
  if (!token) throw new ResetError("invalid_or_expired_token");

  const won = await consumeToken(token.id, db);
  if (!won) throw new ResetError("invalid_or_expired_token");

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, BCRYPT_COST);
  await db.user.update({
    where: { id: token.userId },
    data: { passwordHash },
  });
  // Burn any other outstanding reset tokens for this user.
  await invalidateOutstandingTokens(token.userId, "password_reset", db);
}
