import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../register";
import { loginCredentials } from "../login";

const BASE_URL = "http://localhost:3000";

describe("loginCredentials", () => {
  it("AC-A1.6: returns user info for correct credentials", async () => {
    const reg = await registerUser(
      { email: "henry@example.com", password: "password1234", displayName: "Henry" },
      BASE_URL,
    );
    const result = await loginCredentials({ email: "henry@example.com", password: "password1234" });
    expect(result).toMatchObject({ id: reg.userId, email: "henry@example.com", name: "Henry" });
    expect(result?.isEmailVerified).toBe(false);
  });

  it("returns null for wrong password", async () => {
    await registerUser(
      { email: "ivy@example.com", password: "password1234", displayName: "Ivy" },
      BASE_URL,
    );
    expect(await loginCredentials({ email: "ivy@example.com", password: "wrong5678" })).toBeNull();
  });

  it("returns null for unknown email", async () => {
    expect(await loginCredentials({ email: "ghost@nowhere.com", password: "password1234" })).toBeNull();
  });

  it("returns null for malformed input", async () => {
    expect(await loginCredentials({ email: "not-an-email", password: "" })).toBeNull();
  });

  it("returns null for user without password provider (e.g. Google-only)", async () => {
    // Create a user with no AuthProvider("password") row.
    const u = await prisma.user.create({
      data: {
        email: "google-only@example.com",
        displayName: "G",
        passwordHash: null,
      },
    });
    expect(
      await loginCredentials({ email: "google-only@example.com", password: "anything12" }),
    ).toBeNull();
    await prisma.user.delete({ where: { id: u.id } });
  });

  it("isEmailVerified=true after verifying", async () => {
    const reg = await registerUser(
      { email: "jack@example.com", password: "password1234", displayName: "Jack" },
      BASE_URL,
    );
    await prisma.user.update({
      where: { id: reg.userId },
      data: { emailVerifiedAt: new Date() },
    });
    const result = await loginCredentials({ email: "jack@example.com", password: "password1234" });
    expect(result?.isEmailVerified).toBe(true);
  });
});
