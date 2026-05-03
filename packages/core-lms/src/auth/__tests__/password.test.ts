import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../register";
import { loginCredentials } from "../login";
import { changePassword, ChangePasswordError } from "../password";

const BASE_URL = "http://localhost:3000";

async function makeUser(email: string, password = "password1234") {
  const reg = await registerUser({ email, password, displayName: "X" }, BASE_URL);
  return reg.userId;
}

describe("changePassword", () => {
  it("rotates password when current is correct", async () => {
    const userId = await makeUser("pw-rotate@example.com", "oldpassword12");

    await changePassword(userId, {
      currentPassword: "oldpassword12",
      newPassword: "newpassword34",
    });

    expect(
      await loginCredentials({ email: "pw-rotate@example.com", password: "oldpassword12" }),
    ).toBeNull();
    expect(
      await loginCredentials({ email: "pw-rotate@example.com", password: "newpassword34" }),
    ).toMatchObject({ email: "pw-rotate@example.com" });
  });

  it("writes an audit log entry on success", async () => {
    const userId = await makeUser("pw-audit@example.com", "oldpassword12");

    await changePassword(userId, {
      currentPassword: "oldpassword12",
      newPassword: "newpassword34",
    });

    const audits = await prisma.auditLog.findMany({
      where: { actorUserId: userId, action: "user.password.changed" },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.targetUserId).toBe(userId);
  });

  it("rejects when current password is wrong", async () => {
    const userId = await makeUser("pw-wrong@example.com", "oldpassword12");

    await expect(
      changePassword(userId, {
        currentPassword: "WRONGPASSWORD",
        newPassword: "newpassword34",
      }),
    ).rejects.toMatchObject({ code: "current_password_incorrect" });

    // Original password unchanged.
    expect(
      await loginCredentials({ email: "pw-wrong@example.com", password: "oldpassword12" }),
    ).toMatchObject({ email: "pw-wrong@example.com" });
  });

  it("rejects when new password matches current (no-op)", async () => {
    const userId = await makeUser("pw-same@example.com", "samepassword12");

    await expect(
      changePassword(userId, {
        currentPassword: "samepassword12",
        newPassword: "samepassword12",
      }),
    ).rejects.toMatchObject({ code: "same_as_current" });
  });

  it("rejects new password under 8 chars", async () => {
    const userId = await makeUser("pw-short@example.com", "oldpassword12");

    await expect(
      changePassword(userId, {
        currentPassword: "oldpassword12",
        newPassword: "short",
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("rejects when user has no password set (SSO-only)", async () => {
    // Simulate an SSO-only user: row exists, but passwordHash is null.
    const user = await prisma.user.create({
      data: {
        email: "pw-sso@example.com",
        displayName: "SSO User",
        passwordHash: null,
      },
    });

    await expect(
      changePassword(user.id, {
        currentPassword: "anything12",
        newPassword: "newpassword34",
      }),
    ).rejects.toMatchObject({ code: "no_password_set" });
  });
});
