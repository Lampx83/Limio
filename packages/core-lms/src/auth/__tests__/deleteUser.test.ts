import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../register";
import { grantRole } from "../roles";
import { loginOrLinkSso } from "../sso";
import { DeleteUserError, deleteUser, isDeletedUserEmail } from "../deleteUser";

async function makeUser(email: string) {
  const reg = await registerUser(
    { email, password: "password1234", displayName: email },
    "http://localhost:3000",
  );
  return reg.userId;
}

describe("deleteUser", () => {
  it("ẩn danh hoá: gỡ định danh + quyền, giữ row và audit", async () => {
    const adminId = await makeUser("admin@example.com");
    const targetId = await makeUser("student@example.com");
    await grantRole(adminId, { targetUserId: targetId, roleName: "learner" });

    await deleteUser(adminId, targetId);

    const u = await prisma.user.findUniqueOrThrow({ where: { id: targetId } });
    expect(isDeletedUserEmail(u.email)).toBe(true);
    expect(u.passwordHash).toBeNull();
    expect(u.displayName).not.toContain("student");
    expect(await prisma.authProvider.count({ where: { userId: targetId } })).toBe(0);
    expect(await prisma.userRole.count({ where: { userId: targetId } })).toBe(0);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "user.deleted" } });
    expect(audit.actorUserId).toBe(adminId);
    expect(JSON.stringify(audit.payload)).not.toContain("student@example.com");
  });

  it("từ chối tự xoá, xoá lần hai, và user không tồn tại", async () => {
    const adminId = await makeUser("admin@example.com");
    const targetId = await makeUser("t@example.com");
    await expect(deleteUser(adminId, adminId)).rejects.toMatchObject({ code: "cannot_delete_self" });
    await deleteUser(adminId, targetId);
    await expect(deleteUser(adminId, targetId)).rejects.toMatchObject({ code: "already_deleted" });
    await expect(
      deleteUser(adminId, "00000000-0000-4000-8000-000000000000"),
    ).rejects.toBeInstanceOf(DeleteUserError);
  });

  it("chặn khi user là owner khoá học", async () => {
    const adminId = await makeUser("admin@example.com");
    const teacherId = await makeUser("gv@example.com");
    const course = await prisma.course.create({
      data: { slug: "c1", title: "Khoá A", description: "x", status: "draft" },
    });
    await prisma.courseInstructor.create({
      data: { courseId: course.id, userId: teacherId, role: "owner" },
    });
    await expect(deleteUser(adminId, teacherId)).rejects.toMatchObject({
      code: "has_ownership",
      blockers: [{ kind: "course_owner", title: "Khoá A" }],
    });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: teacherId } });
    expect(u.email).toBe("gv@example.com");
  });

  it("đăng ký lại bằng email cũ và đăng nhập Google lại đều tạo tài khoản mới, trống", async () => {
    const adminId = await makeUser("admin@example.com");
    const oldId = await makeUser("student@example.com");
    await deleteUser(adminId, oldId);

    const newId = await makeUser("student@example.com");
    expect(newId).not.toBe(oldId);
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: newId } });
    expect(fresh.email).toBe("student@example.com");
    expect(await prisma.enrollment.count({ where: { userId: newId } })).toBe(0);

    // Google với cùng email: liên kết vào tài khoản mới, không sống lại tài khoản đã xoá.
    const sso = await loginOrLinkSso({
      provider: "google",
      providerUserId: "g-123",
      email: "student@example.com",
      name: "Student",
      emailVerifiedByProvider: true,
    });
    expect(sso?.id).toBe(newId);
    const old = await prisma.user.findUniqueOrThrow({ where: { id: oldId } });
    expect(isDeletedUserEmail(old.email)).toBe(true);
  });
});
