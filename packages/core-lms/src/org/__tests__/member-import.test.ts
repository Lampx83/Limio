import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { prisma } from "@feedbackme/db";
import {
  importOrgMembers,
  parseMemberImportSheet,
  parseMemberImportText,
  previewOrgMemberImport,
  MEMBER_IMPORT_MAX_ROWS,
} from "../member-import";
import { updateOrgEmailSettings } from "../email-settings";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const mk = (tag: string) =>
    registerUser(
      { email: `${tag}-${slug}@e.com`, password: "password1234", displayName: tag },
      BASE,
    );
  const admin = await mk("padmin");
  await grantRole(admin.userId, { targetUserId: admin.userId, roleName: "admin" });
  const outsider = await mk("outsider");
  const orgAdmin = await mk("orgadmin");
  const free = await mk("free"); // có tài khoản, chưa thuộc trường
  const member = await mk("member");
  const other = await mk("other");
  const stamp = Date.now();
  const org = await prisma.organization.create({ data: { code: `M-${slug}-${stamp}`, name: "Org" } });
  const orgOther = await prisma.organization.create({ data: { code: `O-${slug}-${stamp}`, name: "Other" } });
  await prisma.organizationAdmin.create({ data: { organizationId: org.id, userId: orgAdmin.userId } });
  await prisma.user.update({ where: { id: member.userId }, data: { organizationId: org.id } });
  await prisma.user.update({ where: { id: other.userId }, data: { organizationId: orgOther.id } });
  return {
    adminId: admin.userId,
    outsiderId: outsider.userId,
    orgAdminId: orgAdmin.userId,
    orgId: org.id,
    emails: { free: free.email, member: member.email, other: other.email },
    newEmail: `new-${slug}-${stamp}@e.com`,
  };
}

describe("parse", () => {
  it("text: nhận phân cách tab/;/, và bỏ dòng trống", () => {
    const rows = parseMemberImportText("a@x.com\tAn\n\nb@x.com;Bình\nc@x.com, Cường\nd@x.com");
    expect(rows.map((r) => [r.line, r.email, r.displayName])).toEqual([
      [1, "a@x.com", "An"],
      [3, "b@x.com", "Bình"],
      [4, "c@x.com", "Cường"],
      [5, "d@x.com", undefined],
    ]);
  });

  it("text: dòng header email,name được bỏ qua", () => {
    const rows = parseMemberImportText("Email,Họ tên\na@x.com,An");
    expect(rows).toEqual([{ line: 2, email: "a@x.com", displayName: "An" }]);
  });

  it("xlsx: header tiếng Việt, cột đảo thứ tự", () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Họ và tên", "Email"],
      ["An", "a@x.com"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "S");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    expect(parseMemberImportSheet(buf)).toEqual([{ line: 2, email: "a@x.com", displayName: "An" }]);
  });
});

describe("previewOrgMemberImport / importOrgMembers", () => {
  it("phân loại đúng từng dòng và KHÔNG ghi gì", async () => {
    const s = await setup("mi1");
    const rows = parseMemberImportText(
      [s.newEmail, s.emails.free, s.emails.member, s.emails.other, "khong-hop-le", s.newEmail].join("\n"),
    );
    const before = await prisma.user.count();
    const p = await previewOrgMemberImport(s.adminId, s.orgId, rows);
    expect(p.rows.map((r) => r.status)).toEqual([
      "new", "existing", "already_member", "other_org", "invalid_email", "duplicate",
    ]);
    expect(p.actionable).toBe(2);
    expect(await prisma.user.count()).toBe(before);
  });

  it("import: tạo user mới (Learner, đúng org), gắn user sẵn có, bỏ qua phần còn lại", async () => {
    const s = await setup("mi2");
    const rows = parseMemberImportText(
      `${s.newEmail},Người Mới\n${s.emails.free}\n${s.emails.member}\n${s.emails.other}`,
    );
    const r = await importOrgMembers(s.adminId, s.orgId, rows, { baseUrl: BASE });
    expect(r).toMatchObject({ created: 1, attached: 1, skipped: 2, failed: 0 });

    const created = await prisma.user.findUniqueOrThrow({
      where: { email: s.newEmail },
      include: { userRoles: { include: { role: true } } },
    });
    expect(created.organizationId).toBe(s.orgId);
    expect(created.displayName).toBe("Người Mới");
    expect(created.userRoles.map((x) => x.role.name)).toEqual(["learner"]);

    const free = await prisma.user.findUniqueOrThrow({ where: { email: s.emails.free } });
    expect(free.organizationId).toBe(s.orgId);
    const other = await prisma.user.findUniqueOrThrow({ where: { email: s.emails.other } });
    expect(other.organizationId).not.toBe(s.orgId); // không bị kéo khỏi trường khác
  });

  it("chạy lại lần hai là idempotent (mọi dòng thành skipped)", async () => {
    const s = await setup("mi3");
    const rows = parseMemberImportText(`${s.newEmail}\n${s.emails.free}`);
    await importOrgMembers(s.adminId, s.orgId, rows, { baseUrl: BASE });
    const again = await importOrgMembers(s.adminId, s.orgId, rows, { baseUrl: BASE });
    expect(again).toMatchObject({ created: 0, attached: 0, skipped: 2 });
  });

  it("mail mời theo cấu hình của trường, giống nhau cho Platform Admin và OrgAdmin", async () => {
    const s = await setup("mi6");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const one = (email: string) => [{ line: 1, email }];

    // Mặc định TẮT: cả admin nền tảng lẫn OrgAdmin đều tạo im lặng.
    const off = await previewOrgMemberImport(s.adminId, s.orgId, one(s.newEmail));
    expect(off.willSendInvite).toBe(false);
    const rAdminOff = await importOrgMembers(s.adminId, s.orgId, one(s.newEmail), { baseUrl: BASE });
    expect(rAdminOff.results[0]).toMatchObject({ outcome: "created", invited: false });
    const e2 = `b-${s.newEmail}`;
    const rOrgOff = await importOrgMembers(s.orgAdminId, s.orgId, one(e2), { baseUrl: BASE });
    expect(rOrgOff.results[0]).toMatchObject({ outcome: "created", invited: false });

    // Bật: cả hai đều gửi.
    await updateOrgEmailSettings(s.orgAdminId, s.orgId, { inviteEmailOnImport: true });
    const on = await previewOrgMemberImport(s.adminId, s.orgId, one(`c-${s.newEmail}`));
    expect(on.willSendInvite).toBe(true);
    const rAdminOn = await importOrgMembers(s.adminId, s.orgId, one(`c-${s.newEmail}`), { baseUrl: BASE });
    expect(rAdminOn.results[0]).toMatchObject({ outcome: "created", invited: true });
    const rOrgOn = await importOrgMembers(s.orgAdminId, s.orgId, one(`d-${s.newEmail}`), { baseUrl: BASE });
    expect(rOrgOn.results[0]).toMatchObject({ outcome: "created", invited: true });
    spy.mockRestore();
  });

  it("chỉ Platform Admin / OrgAdmin của trường đổi được công tắc, và có audit", async () => {
    const s = await setup("mi7");
    await expect(updateOrgEmailSettings(s.outsiderId, s.orgId, { inviteEmailOnImport: true })).rejects.toMatchObject({
      code: "forbidden",
    });
    await expect(
      updateOrgEmailSettings(s.adminId, "00000000-0000-0000-0000-000000000000", { inviteEmailOnImport: true }),
    ).rejects.toMatchObject({ code: "org_not_found" });

    expect(
      await updateOrgEmailSettings(s.adminId, s.orgId, { inviteEmailOnImport: true }),
    ).toMatchObject({ inviteEmailOnImport: true, inviteEmailOnInstructorAdd: true });
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "org.email_setting_changed", actorUserId: s.adminId },
    });
    expect(audit.payload).toMatchObject({
      organizationId: s.orgId,
      setting: "inviteEmailOnImport",
      from: false,
      to: true,
    });

    const count = () => prisma.auditLog.count({ where: { action: "org.email_setting_changed" } });
    const before = await count();
    await updateOrgEmailSettings(s.adminId, s.orgId, { inviteEmailOnImport: true }); // no-op
    expect(await count()).toBe(before);
  });

  it("người ngoài (không phải OrgAdmin/Platform Admin) bị từ chối", async () => {
    const s = await setup("mi4");
    await expect(
      previewOrgMemberImport(s.outsiderId, s.orgId, [{ line: 1, email: "a@x.com" }]),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rỗng / vượt trần dòng bị chặn", async () => {
    const s = await setup("mi5");
    await expect(previewOrgMemberImport(s.adminId, s.orgId, [])).rejects.toMatchObject({ code: "no_rows" });
    const many = Array.from({ length: MEMBER_IMPORT_MAX_ROWS + 1 }, (_, i) => ({
      line: i + 1,
      email: `u${i}@x.com`,
    }));
    await expect(previewOrgMemberImport(s.adminId, s.orgId, many)).rejects.toMatchObject({
      code: "too_many_rows",
    });
  });
});
