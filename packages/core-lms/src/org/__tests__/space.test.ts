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

describe("updateOrganizationSpace", () => {
  it("OrgAdmin lưu được; người ngoài bị chặn; đọc cũng cần quyền", async () => {
    const t = await setup("sp1");
    const slug = `sp1-${Date.now()}`;
    const r = await updateOrganizationSpace(t.orgAdmin, t.org.id, { spaceEnabled: true, spaceSlug: slug, space: space() });
    expect(r).toEqual({ spaceEnabled: true, spaceSlug: slug });
    const data = await getOrganizationSpaceAdminData(t.orgAdmin, t.org.id);
    expect(data.spaceSlug).toBe(slug);
    await expect(updateOrganizationSpace(t.outsider, t.org.id, { spaceEnabled: false, spaceSlug: null, space: space() })).rejects.toMatchObject({ code: "forbidden" });
    await expect(getOrganizationSpaceAdminData(t.outsider, t.org.id)).rejects.toBeInstanceOf(OrgSpaceError);
  });

  it("kiểm tra slug: bắt buộc khi bật, hợp lệ, không trùng, slug dựng sẵn chỉ Platform Admin", async () => {
    const t = await setup("sp2");
    const call = (slug: string | null, enabled = true, actor = t.orgAdmin, orgId = t.org.id) =>
      updateOrganizationSpace(actor, orgId, { spaceEnabled: enabled, spaceSlug: slug, space: space() });
    await expect(call(null)).rejects.toMatchObject({ code: "slug_required" });
    await expect(call("Bad Slug")).rejects.toMatchObject({ code: "invalid_slug" });
    await expect(call("admin")).rejects.toMatchObject({ code: "invalid_slug" });
    await expect(call("micro4asia")).rejects.toMatchObject({ code: "slug_reserved" });
    const slug = `sp2-${Date.now()}`;
    await call(slug);
    await expect(call(slug, true, t.platformAdmin, t.other.id)).rejects.toMatchObject({ code: "slug_taken" });
    // Platform Admin dùng được slug dựng sẵn.
    const builtin = await updateOrganizationSpace(t.platformAdmin, t.other.id, { spaceEnabled: true, spaceSlug: "micro4asia", space: space() });
    expect(builtin.spaceSlug).toBe("micro4asia");
    await prisma.organization.update({ where: { id: t.other.id }, data: { spaceSlug: null, spaceEnabled: false } });
  });

  it("OrgAdmin không gắn thương hiệu lên khoá của trường khác; khoá chưa tồn tại thì được giữ chỗ", async () => {
    const t = await setup("sp3");
    const slugOwn = `own-${Date.now()}`;
    const slugForeign = `foreign-${Date.now()}`;
    const mkCourse = (slug: string, organizationId: string | null) =>
      prisma.course.create({ data: { slug, title: slug, description: "x", status: "published", organizationId } });
    await mkCourse(slugOwn, t.org.id);
    await mkCourse(slugForeign, t.other.id);
    const slug = `sp3-${Date.now()}`;
    await expect(
      updateOrganizationSpace(t.orgAdmin, t.org.id, { spaceEnabled: true, spaceSlug: slug, space: space([{ slug: slugOwn }, { slug: slugForeign }]) }),
    ).rejects.toMatchObject({ code: "course_not_in_org" });
    await updateOrganizationSpace(t.orgAdmin, t.org.id, { spaceEnabled: true, spaceSlug: slug, space: space([{ slug: slugOwn }, { slug: "chua-co-khoa" }]) });
    // Platform Admin không bị giới hạn.
    await updateOrganizationSpace(t.platformAdmin, t.org.id, { spaceEnabled: true, spaceSlug: slug, space: space([{ slug: slugForeign }]) });
  });
});
