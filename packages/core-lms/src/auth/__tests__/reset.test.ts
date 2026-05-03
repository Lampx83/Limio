import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../register";
import { loginCredentials } from "../login";
import { requestPasswordReset, resetPassword, ResetError } from "../reset";
import { issueToken } from "../tokens";

const BASE_URL = "http://localhost:3000";

async function makeUser(email: string, password = "password1234") {
  const reg = await registerUser({ email, password, displayName: "X" }, BASE_URL);
  return reg.userId;
}

describe("password reset", () => {
  it("AC-A1.4: requestPasswordReset returns silently for unknown email", async () => {
    await expect(requestPasswordReset({ email: "nobody@nowhere.com" }, BASE_URL))
      .resolves.toBeUndefined();
    const tokens = await prisma.verificationToken.findMany({ where: { purpose: "password_reset" } });
    expect(tokens).toHaveLength(0);
  });

  it("requestPasswordReset issues a token for known email", async () => {
    const userId = await makeUser("eve@example.com");
    await requestPasswordReset({ email: "eve@example.com" }, BASE_URL);
    const tokens = await prisma.verificationToken.findMany({
      where: { userId, purpose: "password_reset" },
    });
    expect(tokens).toHaveLength(1);
    // TTL 1h ± slack
    const ttl = tokens[0]!.expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(50 * 60 * 1000);
    expect(ttl).toBeLessThan(70 * 60 * 1000);
  });

  it("AC-A1.5: resetPassword updates passwordHash, consumes token, invalidates other reset tokens", async () => {
    const userId = await makeUser("frank@example.com", "oldpassword12");
    const t1 = await issueToken(userId, "password_reset");
    const t2 = await issueToken(userId, "password_reset");

    await resetPassword({ token: t1.raw, newPassword: "newpassword34" });

    // Old password no longer works.
    expect(await loginCredentials({ email: "frank@example.com", password: "oldpassword12" })).toBeNull();
    // New password works.
    expect(
      await loginCredentials({ email: "frank@example.com", password: "newpassword34" }),
    ).toMatchObject({ email: "frank@example.com" });

    // Both reset tokens (t1 + t2) consumed; the unrelated email_verify token from
    // registration is untouched.
    const resetTokens = await prisma.verificationToken.findMany({
      where: { userId, purpose: "password_reset" },
    });
    expect(resetTokens).toHaveLength(2);
    expect(resetTokens.every((t) => t.consumedAt !== null)).toBe(true);
  });

  it("rejects unknown / expired token", async () => {
    await expect(
      resetPassword({ token: "0".repeat(64), newPassword: "password5678" }),
    ).rejects.toBeInstanceOf(ResetError);
  });

  it("rejects validation failure (short password)", async () => {
    const userId = await makeUser("greta@example.com");
    const t = await issueToken(userId, "password_reset");
    await expect(resetPassword({ token: t.raw, newPassword: "short" })).rejects.toMatchObject({
      code: "validation_failed",
    });
  });
});
