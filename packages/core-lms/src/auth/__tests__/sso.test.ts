import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { loginOrLinkSso } from "../sso";

const input = (email: string, sub: string) => ({
  provider: "google" as const,
  providerUserId: sub,
  email,
  name: "Sso User",
  emailVerifiedByProvider: true,
});

async function roleNames(userId: string) {
  const rows = await prisma.userRole.findMany({ where: { userId }, include: { role: true } });
  return rows.map((r) => r.role.name);
}

describe("loginOrLinkSso — vai trò mặc định", () => {
  it("user SSO mới được gán learner, giống đăng ký bằng mật khẩu", async () => {
    const res = await loginOrLinkSso(input("sso-new@example.com", "g-1"));
    expect(await roleNames(res!.id)).toEqual([RoleName.Learner]);
  });

  it("đăng nhập lại không nhân đôi role", async () => {
    const first = await loginOrLinkSso(input("sso-again@example.com", "g-2"));
    await loginOrLinkSso(input("sso-again@example.com", "g-2"));
    expect(await roleNames(first!.id)).toEqual([RoleName.Learner]);
  });

  it("liên kết vào user có sẵn không đụng tới role của họ", async () => {
    const admin = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.Admin } });
    const u = await prisma.user.create({
      data: { email: "sso-existing@example.com", displayName: "X", userRoles: { create: { roleId: admin.id } } },
    });
    await loginOrLinkSso(input("sso-existing@example.com", "g-3"));
    expect(await roleNames(u.id)).toEqual([RoleName.Admin]);
  });
});
