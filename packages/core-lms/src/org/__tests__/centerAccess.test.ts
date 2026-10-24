import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  hasClassSchedule,
  isCenterEnabledForUser,
  setOrgCenterEnabled,
} from "../centerAccess";
import { OrgMemberError } from "../members";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";
import { createCourse } from "../../courses/courses";
import { createCourseSection } from "../../courses/sections";
import { setClassSchedule } from "../../courses/classSchedule";

const BASE = "http://localhost:3000";
const NOW = new Date("2026-10-23T03:00:00.000Z");

async function makeUser(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}

async function makeOrg(code: string) {
  return prisma.organization.create({ data: { code: `${code}-${Date.now()}`, name: `Trường ${code}` } });
}

/** Một khoá có một lớp và (tuỳ chọn) lịch, do `teacher` dạy. */
async function courseWithSection(teacher: string, tag: string, withSchedule: boolean) {
  const { courseId } = await createCourse(teacher, { title: `Khoá ${tag}`, description: "d", slug: `ca-${tag}` });
  const section = await createCourseSection(teacher, courseId, { name: "Lớp A" });
  if (withSchedule) {
    await setClassSchedule(
      teacher,
      section.id,
      { startDate: "2026-11-03", totalMeetings: 2, slots: [{ weekday: 2, startTime: "18:30", durationMin: 120 }] },
      prisma,
      NOW,
    );
  }
  return { courseId, sectionId: section.id };
}

async function seedFlag(defaultValue = false) {
  await prisma.featureFlag.create({
    data: {
      key: "center.access",
      group: "lms",
      name: "Tính năng trung tâm",
      description: "test",
      valueType: "boolean",
      defaultValue,
      sellable: true,
    },
  });
}

describe("setOrgCenterEnabled (G1)", () => {
  it("mặc định tắt; OrgAdmin của chính trường bật được và có ghi nhật ký", async () => {
    const orgAdmin = await makeUser("ca-set-oa@e.com");
    const org = await makeOrg("SET");
    await prisma.organizationAdmin.create({ data: { organizationId: org.id, userId: orgAdmin } });
    expect(org.centerEnabled).toBe(false);

    const res = await setOrgCenterEnabled(orgAdmin, org.id, true);
    expect(res).toEqual({ centerEnabled: true });
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: org.id } })).centerEnabled).toBe(true);

    const audit = await prisma.auditLog.findFirst({ where: { action: "org.center_setting_changed" } });
    expect(audit!.payload).toMatchObject({ organizationId: org.id, from: false, to: true });
  });

  it("Platform Admin bật được trường bất kỳ", async () => {
    const admin = await makeUser("ca-set-pa@e.com");
    await grantRole(admin, { targetUserId: admin, roleName: "admin" });
    const org = await makeOrg("PA");
    await expect(setOrgCenterEnabled(admin, org.id, true)).resolves.toEqual({ centerEnabled: true });
  });

  it("người không phải quản trị, và OrgAdmin của trường khác, bị từ chối; không đổi gì", async () => {
    const stranger = await makeUser("ca-set-x@e.com");
    const otherAdmin = await makeUser("ca-set-oa2@e.com");
    const org = await makeOrg("DENY");
    const other = await makeOrg("OTHER");
    await prisma.organizationAdmin.create({ data: { organizationId: other.id, userId: otherAdmin } });

    for (const who of [stranger, otherAdmin]) {
      await expect(setOrgCenterEnabled(who, org.id, true)).rejects.toBeInstanceOf(OrgMemberError);
    }
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: org.id } })).centerEnabled).toBe(false);
  });

  it("trường không tồn tại → org_not_found; đặt lại đúng giá trị cũ thì không ghi nhật ký", async () => {
    const admin = await makeUser("ca-set-nf@e.com");
    await grantRole(admin, { targetUserId: admin, roleName: "admin" });
    await expect(setOrgCenterEnabled(admin, "no-such-org", true)).rejects.toMatchObject({ code: "org_not_found" });

    const org = await makeOrg("NOOP");
    await setOrgCenterEnabled(admin, org.id, false);
    expect(await prisma.auditLog.count({ where: { action: "org.center_setting_changed" } })).toBe(0);
  });
});

describe("isCenterEnabledForUser (G2)", () => {
  it("tài khoản chưa thuộc trường, không cờ, không lịch → tắt", async () => {
    await seedFlag();
    const u = await makeUser("ca-en-none@e.com");
    expect(await isCenterEnabledForUser(u)).toBe(false);
  });

  it("thành viên của trường đã bật → bật; trường chưa bật → tắt", async () => {
    await seedFlag();
    const on = await makeOrg("ON");
    const off = await makeOrg("OFF");
    await prisma.organization.update({ where: { id: on.id }, data: { centerEnabled: true } });
    const a = await makeUser("ca-en-a@e.com");
    const b = await makeUser("ca-en-b@e.com");
    await prisma.user.update({ where: { id: a }, data: { organizationId: on.id } });
    await prisma.user.update({ where: { id: b }, data: { organizationId: off.id } });
    expect(await isCenterEnabledForUser(a)).toBe(true);
    expect(await isCenterEnabledForUser(b)).toBe(false);
  });

  it("cờ center.access cấp riêng cho một tài khoản không thuộc trường → bật", async () => {
    await seedFlag();
    const u = await makeUser("ca-en-flag@e.com");
    const grantedBy = await makeUser("ca-en-flag-by@e.com");
    await prisma.userFeatureOverride.create({
      data: { userId: u, featureKey: "center.access", value: true, reason: "thử nghiệm", grantedBy },
    });
    expect(await isCenterEnabledForUser(u)).toBe(true);
  });

  it("giảng viên trung tâm luôn thấy khu trung tâm, kể cả khi trường chưa bật", async () => {
    await seedFlag();
    const admin = await makeUser("ca-en-ct-admin@e.com");
    await grantRole(admin, { targetUserId: admin, roleName: "admin" });
    const ct = await makeUser("ca-en-ct@e.com");
    await grantRole(admin, { targetUserId: ct, roleName: "center_teacher" });
    expect(await isCenterEnabledForUser(ct)).toBe(true);
  });

  it("thiếu dòng cờ trong DB không làm hỏng: coi là tắt", async () => {
    const u = await makeUser("ca-en-noflag@e.com");
    expect(await isCenterEnabledForUser(u)).toBe(false);
  });

  it("đang dạy khoá có lớp đã đặt lịch → bật dù trường tắt (không mất lối vào); lớp chưa có lịch thì không", async () => {
    await seedFlag();
    const withSched = await makeUser("ca-en-s@e.com");
    const noSched = await makeUser("ca-en-ns@e.com");
    await courseWithSection(withSched, "en-s", true);
    await courseWithSection(noSched, "en-ns", false);
    expect(await isCenterEnabledForUser(withSched)).toBe(true);
    expect(await isCenterEnabledForUser(noSched)).toBe(false);
  });
});

describe("hasClassSchedule (G3)", () => {
  async function enroll(userId: string, courseId: string, sectionId: string, status: "active" | "dropped" = "active") {
    await prisma.enrollment.create({ data: { userId, courseId, sectionId, courseVersion: 1, status } });
  }

  it("học viên đang học ở lớp có lịch → đúng; lớp không có lịch, đã bỏ học, hay không ghi danh → sai", async () => {
    const teacher = await makeUser("ca-hs-t@e.com");
    const sched = await courseWithSection(teacher, "hs-a", true);
    const plain = await courseWithSection(teacher, "hs-b", false);

    const inSched = await makeUser("ca-hs-1@e.com");
    const inPlain = await makeUser("ca-hs-2@e.com");
    const dropped = await makeUser("ca-hs-3@e.com");
    const nobody = await makeUser("ca-hs-4@e.com");
    await enroll(inSched, sched.courseId, sched.sectionId);
    await enroll(inPlain, plain.courseId, plain.sectionId);
    await enroll(dropped, sched.courseId, sched.sectionId, "dropped");

    expect(await hasClassSchedule(inSched)).toBe(true);
    expect(await hasClassSchedule(inPlain)).toBe(false);
    expect(await hasClassSchedule(dropped)).toBe(false);
    expect(await hasClassSchedule(nobody)).toBe(false);
  });
});
