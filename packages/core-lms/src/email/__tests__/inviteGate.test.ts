import { describe, expect, it, vi } from "vitest";
import { prisma } from "@feedbackme/db";
import { findOrInviteUserByEmail } from "../../auth/invite";
import { inviteKindForTemplate, isInviteEmailEnabled } from "../inviteGate";
import { updateOrgEmailSettings } from "../../org/email-settings";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";

const BASE = "http://localhost:3000";

describe("inviteKindForTemplate", () => {
  it("phân nhóm template mời", () => {
    expect(inviteKindForTemplate("course.co_instructor_invite")).toBe("instructor");
    expect(inviteKindForTemplate("cohort.instructor_invite")).toBe("instructor");
    expect(inviteKindForTemplate("exam.instructor_invite_bulk")).toBe("instructor");
    expect(inviteKindForTemplate("exam.proctor_invite")).toBe("proctor");
    expect(inviteKindForTemplate("exam.proctor_invite_bulk")).toBe("proctor");
    expect(inviteKindForTemplate("org.member_invite")).toBeNull(); // luồng thành viên tự quyết
    expect(inviteKindForTemplate("auth.password_reset")).toBeNull();
  });
});

describe("cổng mail mời theo cấu hình trường", () => {
  async function setup(slug: string) {
    const admin = await registerUser(
      { email: `gate-admin-${slug}@e.com`, password: "password1234", displayName: "A" },
      BASE,
    );
    await grantRole(admin.userId, { targetUserId: admin.userId, roleName: "admin" });
    const org = await prisma.organization.create({
      data: { code: `GATE-${slug}-${Date.now()}`, name: "Gate" },
    });
    return { adminId: admin.userId, orgId: org.id, t: Date.now() };
  }

  it("mặc định: GV/giám thị BẬT, import TẮT; không trường (null) thì gửi", async () => {
    const s = await setup("g1");
    expect(await isInviteEmailEnabled("instructor", s.orgId)).toBe(true);
    expect(await isInviteEmailEnabled("proctor", s.orgId)).toBe(true);
    expect(await isInviteEmailEnabled("import", s.orgId)).toBe(false);
    expect(await isInviteEmailEnabled("import", null)).toBe(true);
  });

  it("tắt giám thị: tài khoản vẫn được tạo (đúng trường) nhưng không gửi mail; GV vẫn gửi", async () => {
    const s = await setup("g2");
    await updateOrgEmailSettings(s.adminId, s.orgId, { inviteEmailOnProctorAdd: false });
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    const proctor = await findOrInviteUserByEmail({
      email: `pr-${s.t}@e.com`,
      displayName: "PR",
      baseUrl: BASE,
      templateKey: "exam.proctor_invite",
      organizationId: s.orgId,
    });
    expect(proctor).toMatchObject({ created: true, invited: false });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: proctor.userId } });
    expect(u.organizationId).toBe(s.orgId);

    const instructor = await findOrInviteUserByEmail({
      email: `in-${s.t}@e.com`,
      displayName: "IN",
      baseUrl: BASE,
      templateKey: "cohort.instructor_invite",
      organizationId: s.orgId,
    });
    expect(instructor).toMatchObject({ created: true, invited: true });
    spy.mockRestore();
  });

  it("sendInvite tường minh thắng cấu hình trường", async () => {
    const s = await setup("g3");
    await updateOrgEmailSettings(s.adminId, s.orgId, { inviteEmailOnInstructorAdd: false });
    const r = await findOrInviteUserByEmail({
      email: `force-${s.t}@e.com`,
      displayName: "F",
      baseUrl: BASE,
      templateKey: "course.co_instructor_invite",
      organizationId: s.orgId,
      sendInvite: true,
    });
    expect(r).toMatchObject({ created: true, invited: true });
  });
});
