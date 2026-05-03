import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { RegisterError, registerUser } from "../register";

const BASE_URL = "http://localhost:3000";

describe("registerUser", () => {
  it("AC-A1.1: creates User + AuthProvider + learner role + verification token", async () => {
    const result = await registerUser(
      { email: "alice@example.com", password: "password1234", displayName: "Alice" },
      BASE_URL,
    );
    expect(result.email).toBe("alice@example.com");
    expect(result.verificationUrl).toMatch(/\/verify\?token=[a-f0-9]{64}$/);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: result.userId },
      include: { authProviders: true, userRoles: { include: { role: true } } },
    });
    expect(user.passwordHash).toBeTruthy();
    expect(user.passwordHash).not.toBe("password1234");
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.authProviders).toHaveLength(1);
    expect(user.authProviders[0]?.provider).toBe("password");
    expect(user.userRoles.map((r) => r.role.name)).toEqual([RoleName.Learner]);

    const tokens = await prisma.verificationToken.findMany({ where: { userId: user.id } });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.purpose).toBe("email_verify");
    expect(tokens[0]?.consumedAt).toBeNull();
    // TTL 24h ± a small slack
    const ttlMs = tokens[0]!.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(ttlMs).toBeLessThan(25 * 60 * 60 * 1000);
  });

  it("normalizes email to lowercase + trim", async () => {
    const result = await registerUser(
      { email: "  Bob@Example.COM  ", password: "password1234", displayName: "Bob" },
      BASE_URL,
    );
    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user.email).toBe("bob@example.com");
  });

  it("rejects duplicate email with email_taken", async () => {
    await registerUser(
      { email: "carol@example.com", password: "password1234", displayName: "Carol" },
      BASE_URL,
    );
    await expect(
      registerUser(
        { email: "carol@example.com", password: "password5678", displayName: "Carol2" },
        BASE_URL,
      ),
    ).rejects.toMatchObject({ code: "email_taken" });
  });

  it("rejects invalid input with validation_failed", async () => {
    await expect(
      registerUser({ email: "not-an-email", password: "short", displayName: "" }, BASE_URL),
    ).rejects.toBeInstanceOf(RegisterError);
  });

  it("hashes password with bcrypt cost ≥10 (a 12-cost hash starts with $2a$12$ or $2b$12$)", async () => {
    const result = await registerUser(
      { email: "dan@example.com", password: "password1234", displayName: "Dan" },
      BASE_URL,
    );
    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user.passwordHash).toMatch(/^\$2[ab]\$1[02]\$/);
  });
});
