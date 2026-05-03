import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../register";
import { verifyEmail, VerifyError } from "../verify";

const BASE_URL = "http://localhost:3000";

async function newUserAndToken() {
  const reg = await registerUser(
    { email: `u${Date.now()}@e.com`, password: "password1234", displayName: "U" },
    BASE_URL,
  );
  const url = new URL(reg.verificationUrl);
  return { userId: reg.userId, token: url.searchParams.get("token")! };
}

describe("verifyEmail", () => {
  it("AC-A1.3: marks emailVerifiedAt and consumes token", async () => {
    const { userId, token } = await newUserAndToken();
    await verifyEmail(token);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    const dbToken = await prisma.verificationToken.findFirst({ where: { userId } });
    expect(dbToken?.consumedAt).toBeInstanceOf(Date);
  });

  it("rejects re-using a consumed token", async () => {
    const { token } = await newUserAndToken();
    await verifyEmail(token);
    await expect(verifyEmail(token)).rejects.toMatchObject({
      code: "invalid_or_expired_token",
    });
  });

  it("rejects unknown token", async () => {
    await expect(verifyEmail("0".repeat(64))).rejects.toMatchObject({
      code: "invalid_or_expired_token",
    });
  });

  it("rejects expired token", async () => {
    const { userId, token } = await newUserAndToken();
    // Manually expire the token.
    await prisma.verificationToken.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(verifyEmail(token)).rejects.toBeInstanceOf(VerifyError);
  });

  it("does not allow a password_reset token to verify email", async () => {
    const { userId } = await newUserAndToken();
    // Mint a reset token for the same user; should not be valid for email_verify.
    const { issueToken } = await import("../tokens");
    const t = await issueToken(userId, "password_reset");
    await expect(verifyEmail(t.raw)).rejects.toMatchObject({
      code: "invalid_or_expired_token",
    });
  });
});
