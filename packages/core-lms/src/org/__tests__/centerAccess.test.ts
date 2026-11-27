import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  hasClassSchedule,
  isCenterCourse,
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

describe("isCenterEnabledForUser / isCenterCourse (theo loại tổ chức)", () => {
  async function orgOfKind(kind: "school" | "center" | "publisher") {
    const o = await makeOrg(kind);
    return prisma.organization.update({ where: { id: o.id }, data: { kind, centerEnabled: kind === "center" } });
  }

  it("tài khoản chưa thuộc tổ chức nào, không lịch → tắt", async () => {
    expect(await isCenterEnabledForUser(await makeUser("ca-en-none@e.com"))).toBe(false);
  });

  it("thành viên của tổ chức loại trung tâm → bật; trường thường và nhà xuất bản → tắt", async () => {
    const [center, school, publisher] = [await orgOfKind("center"), await orgOfKind("school"), await orgOfKind("publisher")];
    const [a, b, c] = [await makeUser("ca-en-a@e.com"), await makeUser("ca-en-b@e.com"), await makeUser("ca-en-c@e.com")];
    await prisma.user.update({ where: { id: a }, data: { organizationId: center.id } });
    await prisma.user.update({ where: { id: b }, data: { organizationId: school.id } });
    await prisma.user.update({ where: { id: c }, data: { organizationId: publisher.id } });
    expect(await isCenterEnabledForUser(a)).toBe(true);
    expect(await isCenterEnabledForUser(b)).toBe(false);
    expect(await isCenterEnabledForUser(c)).toBe(false);
  });

  it("dạy một khoá thuộc trung tâm → bật dù tài khoản thuộc trường thường; khoá của trường thường hay nhà xuất bản → tắt", async () => {
    const [center, school, publisher] = [await orgOfKind("center"), await orgOfKind("school"), await orgOfKind("publisher")];
    const t = await makeUser("ca-en-t@e.com");
    const u = await makeUser("ca-en-u@e.com");
    const inCenter = await courseWithSection(t, "en-t", false);
    await prisma.course.update({ where: { id: inCenter.courseId }, data: { organizationId: center.id } });
    const inSchool = await courseWithSection(u, "en-u1", false);
    await prisma.course.update({ where: { id: inSchool.courseId }, data: { organizationId: school.id } });
    const inPub = await courseWithSection(u, "en-u2", false);
    await prisma.course.update({ where: { id: inPub.courseId }, data: { organizationId: publisher.id } });
    expect(await isCenterEnabledForUser(t)).toBe(true);
    expect(await isCenterEnabledForUser(u)).toBe(false);
    expect(await isCenterCourse(inCenter.courseId)).toBe(true);
    expect(await isCenterCourse(inSchool.courseId)).toBe(false);
    expect(await isCenterCourse(inPub.courseId)).toBe(false);
  });

  it("quản trị của tổ chức loại trung tâm → bật; quản trị nhà xuất bản → tắt", async () => {
    const center = await orgOfKind("center");
    const publisher = await orgOfKind("publisher");
    const a = await makeUser("ca-en-oa1@e.com");
    const b = await makeUser("ca-en-oa2@e.com");
    await prisma.organizationAdmin.create({ data: { organizationId: center.id, userId: a } });
    await prisma.organizationAdmin.create({ data: { organizationId: publisher.id, userId: b } });
    expect(await isCenterEnabledForUser(a)).toBe(true);
    expect(await isCenterEnabledForUser(b)).toBe(false);
  });

  it("vai center_teacher đứng một mình, hay cờ center.access cũ, không còn bật tính năng trung tâm", async () => {
    const admin = await makeUser("ca-en-ct-admin@e.com");
    await grantRole(admin, { targetUserId: admin, roleName: "admin" });
    const ct = await makeUser("ca-en-ct@e.com");
    await grantRole(admin, { targetUserId: ct, roleName: "center_teacher" });
    expect(await isCenterEnabledForUser(ct)).toBe(false);
  });

  it("khoá đã có lớp đặt lịch vẫn là khoá trung tâm dù tổ chức là trường thường (không mất lối vào); lớp chưa có lịch thì không", async () => {
    const school = await orgOfKind("school");
    const withSched = await makeUser("ca-en-s@e.com");
    const noSched = await makeUser("ca-en-ns@e.com");
    const a = await courseWithSection(withSched, "en-s", true);
    const b = await courseWithSection(noSched, "en-ns", false);
    await prisma.course.updateMany({ where: { id: { in: [a.courseId, b.courseId] } }, data: { organizationId: school.id } });
    expect(await isCenterEnabledForUser(withSched)).toBe(true);
    expect(await isCenterEnabledForUser(noSched)).toBe(false);
    expect(await isCenterCourse(a.courseId)).toBe(true);
    expect(await isCenterCourse(b.courseId)).toBe(false);
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
