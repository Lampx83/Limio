import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { suggestOrgMemberCandidates, OrgMemberError } from "../members";
import { suggestOrgAdminCandidates, grantOrgAdmin, OrgAdminError } from "../admins";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const mk = (tag: string, name = tag) =>
    registerUser({ email: `${tag}-${slug}@e.com`, password: "password1234", displayName: name }, BASE);
  const platformAdmin = await mk("padmin");
  await grantRole(platformAdmin.userId, { targetUserId: platformAdmin.userId, roleName: "admin" });
  const orgAdmin = await mk("orgadmin");
  const free = await mk("zebra-free", "Zed Free");
  const inA = await mk("zebra-ina", "Zed InA");
  const inB = await mk("zebra-inb", "Zed InB");
  const stranger = await mk("stranger");
  const orgA = await prisma.organization.create({ data: { code: `SA-${slug}-${Date.now()}`, name: "Org A" } });
  const orgB = await prisma.organization.create({ data: { code: `SB-${slug}-${Date.now()}`, name: "Org B" } });
  await prisma.organizationAdmin.create({ data: { organizationId: orgA.id, userId: orgAdmin.userId } });
  await prisma.user.update({ where: { id: inA.userId }, data: { organizationId: orgA.id } });
  await prisma.user.update({ where: { id: inB.userId }, data: { organizationId: orgB.id } });
  return { padmin: platformAdmin.userId, orgAdmin: orgAdmin.userId, stranger: stranger.userId, orgA: orgA.id, orgB: orgB.id };
}

describe("suggestOrgMemberCandidates", () => {
  it("Platform Admin thấy cả người ở trường khác, kèm trạng thái và tên trường", async () => {
    const s = await setup("sg1");
    const r = await suggestOrgMemberCandidates(s.padmin, s.orgA, "zebra");
    const by = Object.fromEntries(r.map((x) => [x.email.split("@")[0]!.split("-").slice(0, 2).join("-"), x]));
    expect(by["zebra-free"]?.status).toBe("available");
    expect(by["zebra-ina"]?.status).toBe("member");
    expect(by["zebra-inb"]?.status).toBe("other_org");
    expect(by["zebra-inb"]?.otherOrgName).toBe("Org B");
  });

  it("OrgAdmin KHÔNG thấy người ở trường khác (kể cả tên trường)", async () => {
    const s = await setup("sg2");
    const r = await suggestOrgMemberCandidates(s.orgAdmin, s.orgA, "zebra");
    expect(r.map((x) => x.status).sort()).toEqual(["available", "member"]);
    expect(JSON.stringify(r)).not.toContain("Org B");
    expect(JSON.stringify(r)).not.toContain("zebra-inb");
  });

  it("OrgAdmin cần gõ ≥ 3 ký tự, Platform Admin ≥ 2", async () => {
    const s = await setup("sg3");
    expect(await suggestOrgMemberCandidates(s.orgAdmin, s.orgA, "ze")).toEqual([]);
    expect((await suggestOrgMemberCandidates(s.padmin, s.orgA, "ze")).length).toBeGreaterThan(0);
  });

  it("người không phải OrgAdmin của trường bị từ chối", async () => {
    const s = await setup("sg4");
    await expect(suggestOrgMemberCandidates(s.stranger, s.orgA, "zebra")).rejects.toBeInstanceOf(OrgMemberError);
  });

  it("khớp đầu email xếp trước khớp giữa chuỗi", async () => {
    const s = await setup("sg5");
    const r = await suggestOrgMemberCandidates(s.padmin, s.orgA, "zebra-free");
    expect(r[0]?.email.startsWith("zebra-free")).toBe(true);
  });
});


describe("suggestOrgAdminCandidates", () => {
  it("gợi ý theo email/tên, đánh dấu người đã là OrgAdmin của tổ chức", async () => {
    const s = await setup("sa1");
    const target = await prisma.user.findFirstOrThrow({ where: { email: { startsWith: "zebra-free-sa1" } } });
    await grantOrgAdmin(s.padmin, s.orgA, target.email);
    const r = await suggestOrgAdminCandidates(s.padmin, s.orgA, "zebra");
    const free = r.find((x) => x.email.startsWith("zebra-free"));
    const other = r.find((x) => x.email.startsWith("zebra-ina"));
    expect(free?.status).toBe("already_admin");
    expect(other?.status).toBe("available");
    // Tổ chức khác không bị ảnh hưởng.
    const rb = await suggestOrgAdminCandidates(s.padmin, s.orgB, "zebra-free");
    expect(rb[0]?.status).toBe("available");
  });

  it("chỉ Platform Admin: OrgAdmin của trường cũng bị từ chối", async () => {
    const s = await setup("sa2");
    await expect(suggestOrgAdminCandidates(s.orgAdmin, s.orgA, "zebra")).rejects.toBeInstanceOf(OrgAdminError);
  });

  it("gõ dưới 2 ký tự thì không trả gì", async () => {
    const s = await setup("sa3");
    expect(await suggestOrgAdminCandidates(s.padmin, s.orgA, "z")).toEqual([]);
  });
});
