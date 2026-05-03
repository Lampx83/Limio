import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { registerUser } from "../register";
import { getRolesForUser, grantRole, isAdmin, RoleError, revokeRole } from "../roles";

const BASE_URL = "http://localhost:3000";

async function makeUser(email: string) {
  const reg = await registerUser(
    { email, password: "password1234", displayName: email },
    BASE_URL,
  );
  return reg.userId;
}

async function makeCourse(slug = "demo") {
  const c = await prisma.course.create({
    data: { slug, title: "Demo", description: "x", status: "draft" },
  });
  return c.id;
}

describe("roles", () => {
  it("AC-A1.8 grant: creates UserRole + writes audit, idempotent", async () => {
    const adminId = await makeUser("admin@example.com");
    const targetId = await makeUser("target@example.com");

    const r1 = await grantRole(adminId, { targetUserId: targetId, roleName: "instructor" });
    expect(r1.created).toBe(true);

    // Re-grant same tuple → no-op, no new row, no new audit.
    const r2 = await grantRole(adminId, { targetUserId: targetId, roleName: "instructor" });
    expect(r2.created).toBe(false);

    const audits = await prisma.auditLog.findMany({ where: { action: "role.granted" } });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.actorUserId).toBe(adminId);
    expect(audits[0]?.targetUserId).toBe(targetId);
  });

  it("AC-A1.10 course-scoped role: same user can hold different roles in different courses", async () => {
    const adminId = await makeUser("a2@example.com");
    const userId = await makeUser("u2@example.com");
    const courseA = await makeCourse("a");
    const courseB = await makeCourse("b");

    await grantRole(adminId, { targetUserId: userId, roleName: "instructor", courseId: courseA });
    await grantRole(adminId, { targetUserId: userId, roleName: "learner", courseId: courseB });

    const inA = await getRolesForUser(userId, courseA);
    expect(inA.map((r) => r.roleName).sort()).toEqual(["instructor", "learner"]); // includes platform-wide learner from registration
    const inB = await getRolesForUser(userId, courseB);
    expect(inB.map((r) => r.roleName).sort()).toEqual(["learner", "learner"]);
  });

  it("AC-A1.9 revoke: deletes row + writes audit", async () => {
    const adminId = await makeUser("a3@example.com");
    const targetId = await makeUser("t3@example.com");
    const grant = await grantRole(adminId, { targetUserId: targetId, roleName: "mentor" });

    await revokeRole(adminId, { userRoleId: grant.userRoleId });

    const row = await prisma.userRole.findUnique({ where: { id: grant.userRoleId } });
    expect(row).toBeNull();
    const audit = await prisma.auditLog.findFirst({ where: { action: "role.revoked" } });
    expect(audit).not.toBeNull();
    expect(audit?.targetUserId).toBe(targetId);
  });

  it("revoke unknown userRoleId throws user_role_not_found", async () => {
    const adminId = await makeUser("a4@example.com");
    await expect(
      revokeRole(adminId, { userRoleId: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toMatchObject({ code: "user_role_not_found" });
  });

  it("grant with non-existent course throws course_not_found", async () => {
    const adminId = await makeUser("a5@example.com");
    const targetId = await makeUser("t5@example.com");
    await expect(
      grantRole(adminId, {
        targetUserId: targetId,
        roleName: "instructor",
        courseId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toMatchObject({ code: "course_not_found" });
  });

  it("grant with bad input throws validation_failed", async () => {
    const adminId = await makeUser("a6@example.com");
    await expect(
      grantRole(adminId, { targetUserId: "not-a-uuid", roleName: "instructor" }),
    ).rejects.toBeInstanceOf(RoleError);
  });

  it("isAdmin true after granting admin role", async () => {
    const adminId = await makeUser("a7@example.com");
    const userId = await makeUser("u7@example.com");
    expect(await isAdmin(userId)).toBe(false);
    await grantRole(adminId, { targetUserId: userId, roleName: RoleName.Admin });
    expect(await isAdmin(userId)).toBe(true);
  });
});
