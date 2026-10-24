import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { setOrgMemberCenterTeacher } from "../centerTeacher";
import { OrgMemberError } from "../members";
import { registerUser } from "../../auth/register";
import { grantRole, isCenterTeacher, isInstructor } from "../../auth/roles";

const BASE = "http://localhost:3000";

async function makeUser(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}

async function makeOrg(code: string) {
  return prisma.organization.create({ data: { code: `${code}-${Date.now()}`, name: `Trường ${code}` } });
}

async function setup(tag: string) {
  const org = await makeOrg(tag);
  const other = await makeOrg(`${tag}-other`);
  const orgAdmin = await makeUser(`ct-${tag}-oa@e.com`);
  const otherAdmin = await makeUser(`ct-${tag}-oa2@e.com`);
  const member = await makeUser(`ct-${tag}-m@e.com`);
  const foreign = await makeUser(`ct-${tag}-f@e.com`);
  const stranger = await makeUser(`ct-${tag}-x@e.com`);
  const admin = await makeUser(`ct-${tag}-pa@e.com`);
  await grantRole(admin, { targetUserId: admin, roleName: "admin" });
  await prisma.organizationAdmin.create({ data: { organizationId: org.id, userId: orgAdmin } });
  await prisma.organizationAdmin.create({ data: { organizationId: other.id, userId: otherAdmin } });
  await prisma.user.update({ where: { id: member }, data: { organizationId: org.id } });
  await prisma.user.update({ where: { id: foreign }, data: { organizationId: other.id } });
  return { org, other, orgAdmin, otherAdmin, member, foreign, stranger, admin };
}

describe("vai trò center_teacher (H1)", () => {
  it("tên vai trò là center_teacher; Platform Admin cấp được; người này không phải giảng viên thường", async () => {
    expect(RoleName.CenterTeacher).toBe("center_teacher");
    const t = await setup("h1");
    const res = await grantRole(t.admin, { targetUserId: t.member, roleName: "center_teacher" });
    expect(res.created).toBe(true);

    expect(await isCenterTeacher(t.member)).toBe(true);
    // Quan trọng: không tự thành giảng viên thường, nên không tạo/sửa được khoá.
    expect(await isInstructor(t.member)).toBe(false);
    expect(await isCenterTeacher(t.stranger)).toBe(false);
  });

  it("người vừa là giảng viên thường vừa là giảng viên trung tâm vẫn là giảng viên thường", async () => {
    const t = await setup("h1b");
    await grantRole(t.admin, { targetUserId: t.member, roleName: "instructor" });
    await grantRole(t.admin, { targetUserId: t.member, roleName: "center_teacher" });
    expect(await isInstructor(t.member)).toBe(true);
    expect(await isCenterTeacher(t.member)).toBe(true);
  });
});

describe("setOrgMemberCenterTeacher (H2)", () => {
  it("quản trị trường cấp rồi thu hồi cho thành viên của chính trường; có ghi nhật ký", async () => {
    const t = await setup("h2");
    expect(await setOrgMemberCenterTeacher(t.orgAdmin, t.org.id, t.member, true)).toEqual({ centerTeacher: true });
    expect(await isCenterTeacher(t.member)).toBe(true);

    expect(await setOrgMemberCenterTeacher(t.orgAdmin, t.org.id, t.member, false)).toEqual({ centerTeacher: false });
    expect(await isCenterTeacher(t.member)).toBe(false);

    const logs = await prisma.auditLog.findMany({ where: { action: "org.center_teacher_changed" }, orderBy: { occurredAt: "asc" } });
    expect(logs.map((l) => (l.payload as { to: boolean }).to)).toEqual([true, false]);
    expect(logs[0]!.payload).toMatchObject({ organizationId: t.org.id, targetUserId: t.member, from: false });
  });

  it("Platform Admin cấp được cho thành viên của trường bất kỳ", async () => {
    const t = await setup("h2pa");
    await expect(setOrgMemberCenterTeacher(t.admin, t.org.id, t.member, true)).resolves.toEqual({ centerTeacher: true });
  });

  it("quản trị trường khác, người ngoài đều bị từ chối và không đổi gì", async () => {
    const t = await setup("h2deny");
    for (const who of [t.otherAdmin, t.stranger, t.member]) {
      await expect(setOrgMemberCenterTeacher(who, t.org.id, t.member, true)).rejects.toMatchObject({ code: "forbidden" });
    }
    expect(await isCenterTeacher(t.member)).toBe(false);
  });

  it("người không thuộc trường này → not_member (kể cả thành viên của trường khác)", async () => {
    const t = await setup("h2nm");
    await expect(setOrgMemberCenterTeacher(t.orgAdmin, t.org.id, t.foreign, true)).rejects.toMatchObject({ code: "not_member" });
    await expect(setOrgMemberCenterTeacher(t.orgAdmin, t.org.id, t.stranger, true)).rejects.toBeInstanceOf(OrgMemberError);
    expect(await isCenterTeacher(t.foreign)).toBe(false);
  });

  it("trường không tồn tại → org_not_found (quản trị nền tảng)", async () => {
    const t = await setup("h2nf");
    await expect(setOrgMemberCenterTeacher(t.admin, "no-such-org", t.member, true)).rejects.toMatchObject({ code: "org_not_found" });
  });

  it("cấp lại khi đã có, hay thu hồi khi chưa có, không ghi nhật ký thêm", async () => {
    const t = await setup("h2noop");
    await setOrgMemberCenterTeacher(t.orgAdmin, t.org.id, t.member, false); // chưa có → không đổi
    expect(await prisma.auditLog.count({ where: { action: "org.center_teacher_changed" } })).toBe(0);
    await setOrgMemberCenterTeacher(t.orgAdmin, t.org.id, t.member, true);
    await setOrgMemberCenterTeacher(t.orgAdmin, t.org.id, t.member, true); // đã có
    expect(await prisma.auditLog.count({ where: { action: "org.center_teacher_changed" } })).toBe(1);
  });
});
