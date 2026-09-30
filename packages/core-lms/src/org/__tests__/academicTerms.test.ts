import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  createAcademicTerm,
  deleteAcademicTerm,
  getOrgCalendarContext,
  listAcademicTerms,
  updateAcademicTerm,
} from "../academicTerms";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const orgAdmin = await registerUser(
    { email: `admin-${slug}@e.com`, password: "password1234", displayName: "OrgAdmin" },
    BASE,
  );
  const outsider = await registerUser(
    { email: `outsider-${slug}@e.com`, password: "password1234", displayName: "Outsider" },
    BASE,
  );
  const member = await registerUser(
    { email: `member-${slug}@e.com`, password: "password1234", displayName: "Member" },
    BASE,
  );
  const platformAdmin = await registerUser(
    { email: `padmin-${slug}@e.com`, password: "password1234", displayName: "Platform" },
    BASE,
  );
  await grantRole(platformAdmin.userId, { targetUserId: platformAdmin.userId, roleName: "admin" });

  const org = await prisma.organization.create({
    data: { code: `ORG-${slug}-${Date.now()}`, name: `Trường ${slug}` },
  });
  const otherOrg = await prisma.organization.create({
    data: { code: `OTH-${slug}-${Date.now()}`, name: `Trường khác ${slug}` },
  });
  await prisma.organizationAdmin.create({ data: { organizationId: org.id, userId: orgAdmin.userId } });
  await prisma.user.update({ where: { id: member.userId }, data: { organizationId: org.id } });
  return {
    orgAdminId: orgAdmin.userId,
    outsiderId: outsider.userId,
    memberId: member.userId,
    platformAdminId: platformAdmin.userId,
    orgId: org.id,
    otherOrgId: otherOrg.id,
  };
}

const HK1 = { name: "HK1 2026-27", startDate: "2026-09-07", weekCount: 16 };

describe("academic terms — quyền", () => {
  it("OrgAdmin của trường tạo/sửa/xoá được; ngày lưu đúng khoá ngày (không lệch múi giờ)", async () => {
    const { orgAdminId, orgId } = await setup("at1");

    const created = await createAcademicTerm(orgAdminId, orgId, HK1);
    expect(created).toMatchObject({ name: "HK1 2026-27", startDate: "2026-09-07", weekCount: 16 });

    const updated = await updateAcademicTerm(orgAdminId, created.id, { ...HK1, weekCount: 18 });
    expect(updated.weekCount).toBe(18);
    expect((await listAcademicTerms(orgId)).map((t) => t.startDate)).toEqual(["2026-09-07"]);

    await deleteAcademicTerm(orgAdminId, created.id);
    expect(await listAcademicTerms(orgId)).toEqual([]);
  });

  it("Platform Admin cấu hình được cho mọi trường", async () => {
    const { platformAdminId, orgId } = await setup("at2");
    await expect(createAcademicTerm(platformAdminId, orgId, HK1)).resolves.toMatchObject({ weekCount: 16 });
  });

  it("người ngoài, thành viên thường và OrgAdmin của trường KHÁC đều bị chặn", async () => {
    const { outsiderId, memberId, orgAdminId, orgId, otherOrgId } = await setup("at3");
    await expect(createAcademicTerm(outsiderId, orgId, HK1)).rejects.toMatchObject({ code: "forbidden" });
    await expect(createAcademicTerm(memberId, orgId, HK1)).rejects.toMatchObject({ code: "forbidden" });
    // OrgAdmin của org này không được đụng org kia
    await expect(createAcademicTerm(orgAdminId, otherOrgId, HK1)).rejects.toMatchObject({ code: "forbidden" });

    const t = await createAcademicTerm(orgAdminId, orgId, HK1);
    await expect(updateAcademicTerm(outsiderId, t.id, HK1)).rejects.toMatchObject({ code: "forbidden" });
    await expect(deleteAcademicTerm(outsiderId, t.id)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("academic terms — kiểm tra dữ liệu", () => {
  it("từ chối tên rỗng, ngày không có thật, số tuần ngoài khoảng", async () => {
    const { orgAdminId, orgId } = await setup("at4");
    await expect(createAcademicTerm(orgAdminId, orgId, { ...HK1, name: "  " })).rejects.toMatchObject({
      code: "invalid_name",
    });
    await expect(
      createAcademicTerm(orgAdminId, orgId, { ...HK1, startDate: "2026-02-31" }),
    ).rejects.toMatchObject({ code: "invalid_start_date" });
    await expect(createAcademicTerm(orgAdminId, orgId, { ...HK1, weekCount: 0 })).rejects.toMatchObject({
      code: "invalid_week_count",
    });
    await expect(createAcademicTerm(orgAdminId, orgId, { ...HK1, weekCount: 61 })).rejects.toMatchObject({
      code: "invalid_week_count",
    });
    await expect(createAcademicTerm(orgAdminId, orgId, { ...HK1, weekCount: 1.5 })).rejects.toMatchObject({
      code: "invalid_week_count",
    });
  });

  it("chặn kỳ chồng nhau và báo tên kỳ đang chiếm; kỳ liền kề thì được", async () => {
    const { orgAdminId, orgId } = await setup("at5");
    await createAcademicTerm(orgAdminId, orgId, HK1); // 07/09 → 27/12/2026

    await expect(
      createAcademicTerm(orgAdminId, orgId, { name: "Hè", startDate: "2026-12-21", weekCount: 4 }),
    ).rejects.toMatchObject({
      code: "overlaps_existing_term",
      details: { conflictingTermName: "HK1 2026-27" },
    });

    await expect(
      createAcademicTerm(orgAdminId, orgId, { name: "HK2", startDate: "2026-12-28", weekCount: 15 }),
    ).resolves.toMatchObject({ startDate: "2026-12-28" });
  });

  it("sửa chính kỳ đó không tự đụng chính nó", async () => {
    const { orgAdminId, orgId } = await setup("at6");
    const t = await createAcademicTerm(orgAdminId, orgId, HK1);
    await expect(updateAcademicTerm(orgAdminId, t.id, { ...HK1, weekCount: 17 })).resolves.toMatchObject({
      weekCount: 17,
    });
  });

  it("hai trường khác nhau có thể có kỳ trùng ngày (mỗi trường bắt đầu khác nhau)", async () => {
    const { orgAdminId, platformAdminId, orgId, otherOrgId } = await setup("at7");
    await createAcademicTerm(orgAdminId, orgId, HK1);
    await expect(createAcademicTerm(platformAdminId, otherOrgId, HK1)).resolves.toBeTruthy();
    expect(await listAcademicTerms(orgId)).toHaveLength(1);
  });
});

describe("getOrgCalendarContext", () => {
  it("thành viên trường nhận tên trường + kỳ học của trường mình", async () => {
    const { orgAdminId, memberId, orgId } = await setup("at8");
    await createAcademicTerm(orgAdminId, orgId, HK1);
    const ctx = await getOrgCalendarContext(memberId);
    expect(ctx.organization?.id).toBe(orgId);
    expect(ctx.terms.map((t) => t.name)).toEqual(["HK1 2026-27"]);
  });

  it("tài khoản không thuộc trường nào → không có nhãn kỳ học", async () => {
    const { outsiderId } = await setup("at9");
    expect(await getOrgCalendarContext(outsiderId)).toEqual({ organization: null, terms: [] });
  });
});
