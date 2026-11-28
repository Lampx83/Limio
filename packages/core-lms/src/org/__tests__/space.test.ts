import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { getOrganizationSpaceAdminData, OrgSpaceError, updateOrganizationSpace } from "../space";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";

const BASE = "http://localhost:3000";

async function setup(tag: string) {
  const mk = async (who: string) =>
    (await registerUser({ email: `${who}-${tag}@e.com`, password: "password1234", displayName: who }, BASE)).userId;
  const [orgAdmin, outsider, platformAdmin] = await Promise.all([mk("oa"), mk("out"), mk("pa")]);
  await grantRole(platformAdmin, { targetUserId: platformAdmin, roleName: "admin" });
  const org = await prisma.organization.create({ data: { code: `SP-${tag}-${Date.now()}`, name: `Trường ${tag}` } });
  const other = await prisma.organization.create({ data: { code: `SO-${tag}-${Date.now()}`, name: `Khác ${tag}` } });
  await prisma.organizationAdmin.create({ data: { organizationId: org.id, userId: orgAdmin } });
  return { orgAdmin, outsider, platformAdmin, org, other };
}

const space = (courses: Array<{ slug: string }> = []) => ({ name: "X", courses });

describe("space chỉ dành cho Platform Admin (chốt 2026-11-28)", () => {
  it("OrgAdmin của chính tổ chức, người ngoài đều bị chặn cả đọc lẫn ghi; Platform Admin làm được", async () => {
    const t = await setup("sp0");
    const input = { spaceEnabled: false, spaceSlug: null, space: space() };
    for (const who of [t.orgAdmin, t.outsider]) {
      await expect(getOrganizationSpaceAdminData(who, t.org.id)).rejects.toBeInstanceOf(OrgSpaceError);
      await expect(updateOrganizationSpace(who, t.org.id, input)).rejects.toMatchObject({ code: "forbidden" });
    }
    await expect(updateOrganizationSpace(t.platformAdmin, t.org.id, input)).resolves.toEqual({ spaceEnabled: false, spaceSlug: null });
    await expect(getOrganizationSpaceAdminData(t.platformAdmin, t.org.id)).resolves.toMatchObject({ id: t.org.id });
  });
});

describe("getOrganizationSpaceAdminData: loại tổ chức", () => {
  it("trả loại của tổ chức (quyết định mẫu space ở form); đổi loại thì không đụng vào space đã lưu", async () => {
    const t = await setup("spk");
    expect((await getOrganizationSpaceAdminData(t.platformAdmin, t.org.id)).kind).toBe("school");
    await updateOrganizationSpace(t.platformAdmin, t.org.id, { spaceEnabled: false, spaceSlug: null, space: { name: "Giữ nguyên" } });
    await prisma.organization.update({ where: { id: t.org.id }, data: { kind: "center", centerEnabled: true } });
    const data = await getOrganizationSpaceAdminData(t.platformAdmin, t.org.id);
    expect(data.kind).toBe("center");
    expect(data.space).toEqual({ name: "Giữ nguyên" });
  });
});

describe("updateOrganizationSpace", () => {
  it("Platform Admin lưu được và đọc lại đúng", async () => {
    const t = await setup("sp1");
    const slug = `sp1-${Date.now()}`;
    const r = await updateOrganizationSpace(t.platformAdmin, t.org.id, { spaceEnabled: true, spaceSlug: slug, space: space() });
    expect(r).toEqual({ spaceEnabled: true, spaceSlug: slug });
    expect((await getOrganizationSpaceAdminData(t.platformAdmin, t.org.id)).spaceSlug).toBe(slug);
  });

  it("kiểm tra slug: bắt buộc khi bật, hợp lệ, không trùng; Platform Admin dùng được slug dựng sẵn", async () => {
    const t = await setup("sp2");
    const call = (slug: string | null, enabled = true, orgId = t.org.id) =>
      updateOrganizationSpace(t.platformAdmin, orgId, { spaceEnabled: enabled, spaceSlug: slug, space: space() });
    await expect(call(null)).rejects.toMatchObject({ code: "slug_required" });
    await expect(call("Bad Slug")).rejects.toMatchObject({ code: "invalid_slug" });
    await expect(call("admin")).rejects.toMatchObject({ code: "invalid_slug" });
    const slug = `sp2-${Date.now()}`;
    await call(slug);
    await expect(call(slug, true, t.other.id)).rejects.toMatchObject({ code: "slug_taken" });
    const builtin = await call("micro4asia", true, t.other.id);
    expect(builtin.spaceSlug).toBe("micro4asia");
    await prisma.organization.update({ where: { id: t.other.id }, data: { spaceSlug: null, spaceEnabled: false } });
  });
});
