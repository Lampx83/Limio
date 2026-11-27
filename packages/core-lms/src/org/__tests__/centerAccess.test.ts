import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  hasClassSchedule,
  isCenterEnabledForUser,
} from "../centerAccess";
import { setOrganizationKind } from "../orgKind";
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

describe("setOrganizationKind (loại tổ chức)", () => {
  it("mặc định là trường thường, centerEnabled tắt", async () => {
    const org = await makeOrg("DEF");
    expect(org.kind).toBe("school");
    expect(org.centerEnabled).toBe(false);
  });

  it("Platform Admin đổi loại; centerEnabled đi theo kind = center; có nhật ký cũ → mới", async () => {
    const admin = await makeUser("ca-kind-pa@e.com");
    await grantRole(admin, { targetUserId: admin, roleName: "admin" });
    const org = await makeOrg("K1");
    await expect(setOrganizationKind(admin, org.id, "center")).resolves.toEqual({ kind: "center" });
    expect(await prisma.organization.findUniqueOrThrow({ where: { id: org.id } })).toMatchObject({ kind: "center", centerEnabled: true });
    const audit = await prisma.auditLog.findFirst({ where: { action: "org.kind_changed" }, orderBy: { occurredAt: "desc" } });
    expect(audit!.payload).toMatchObject({ organizationId: org.id, from: "school", to: "center" });

    await setOrganizationKind(admin, org.id, "publisher");
    expect(await prisma.organization.findUniqueOrThrow({ where: { id: org.id } })).toMatchObject({ kind: "publisher", centerEnabled: false });
  });

  it("OrgAdmin của chính tổ chức KHÔNG tự đổi loại được; người lạ cũng không; không đổi gì", async () => {
    const orgAdmin = await makeUser("ca-kind-oa@e.com");
    const stranger = await makeUser("ca-kind-x@e.com");
    const org = await makeOrg("K2");
    await prisma.organizationAdmin.create({ data: { organizationId: org.id, userId: orgAdmin } });
    for (const who of [orgAdmin, stranger]) {
      await expect(setOrganizationKind(who, org.id, "center")).rejects.toMatchObject({ code: "forbidden" });
    }
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: org.id } })).kind).toBe("school");
  });

  it("tổ chức không tồn tại → org_not_found; loại lạ → validation_failed; đặt lại đúng loại cũ thì không ghi nhật ký", async () => {
    const admin = await makeUser("ca-kind-nf@e.com");
    await grantRole(admin, { targetUserId: admin, roleName: "admin" });
    await expect(setOrganizationKind(admin, "no-such-org", "center")).rejects.toMatchObject({ code: "org_not_found" });
    const org = await makeOrg("K3");
    await expect(setOrganizationKind(admin, org.id, "bakery" as never)).rejects.toMatchObject({ code: "validation_failed" });
    const before = await prisma.auditLog.count({ where: { action: "org.kind_changed" } });
    await setOrganizationKind(admin, org.id, "school");
    expect(await prisma.auditLog.count({ where: { action: "org.kind_changed" } })).toBe(before);
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
