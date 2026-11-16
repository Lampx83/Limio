import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";
import { createCourse } from "../../courses/courses";
import { canViewCourseReport } from "../../reports/access";
import { CourseOrgError, setCourseOrganization } from "../courseOrganization";

const BASE = "http://localhost:3000";
let seq = 0;
const uniq = () => `${Date.now()}-${++seq}`;

async function makeUser(prefix: string) {
  return (await registerUser({ email: `${prefix}-${uniq()}@e.com`, password: "password1234", displayName: prefix }, BASE)).userId;
}

async function setup() {
  const admin = await makeUser("admin");
  await grantRole(admin, { targetUserId: admin, roleName: "admin" });
  const owner = await makeUser("owner");
  const viewer = await makeUser("viewer");
  const org = await prisma.organization.create({ data: { code: `ORG-CO-${uniq()}`, name: "NXB thử" } });
  await prisma.organizationReportViewer.create({ data: { organizationId: org.id, userId: viewer } });
  const { courseId } = await createCourse(owner, { title: "Sách", description: "d", slug: `co-${uniq()}` });
  return { admin, owner, viewer, org, courseId };
}

describe("AC8 — gắn khoá vào tổ chức", () => {
  it("chỉ Platform Admin gắn được; chủ khoá và OrgAdmin thì không", async () => {
    const { owner, org, courseId } = await setup();
    const orgAdmin = await makeUser("orgadmin");
    await prisma.organizationAdmin.create({ data: { organizationId: org.id, userId: orgAdmin } });
    await expect(setCourseOrganization(owner, courseId, org.id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(setCourseOrganization(orgAdmin, courseId, org.id)).rejects.toBeInstanceOf(CourseOrgError);
    expect((await prisma.course.findUniqueOrThrow({ where: { id: courseId } })).organizationId).toBeNull();
  });

  it("gắn xong người xem báo cáo của tổ chức thấy khoá; gỡ ra thì không thấy nữa; ghi AuditLog và sự kiện", async () => {
    const { admin, viewer, org, courseId } = await setup();
    expect(await canViewCourseReport(viewer, courseId)).toBe(false);

    expect(await setCourseOrganization(admin, courseId, org.id)).toEqual({ changed: true });
    expect(await canViewCourseReport(viewer, courseId)).toBe(true);
    // Lưu lại cùng giá trị: không phải thay đổi, không ghi thêm.
    expect(await setCourseOrganization(admin, courseId, org.id)).toEqual({ changed: false });

    expect(await setCourseOrganization(admin, courseId, null)).toEqual({ changed: true });
    expect(await canViewCourseReport(viewer, courseId)).toBe(false);

    const audits = await prisma.auditLog.findMany({ where: { action: "course.organization.changed" }, orderBy: { occurredAt: "asc" } });
    expect(audits.map((a) => a.payload)).toEqual([
      { courseId, fromOrganizationId: null, toOrganizationId: org.id },
      { courseId, fromOrganizationId: org.id, toOrganizationId: null },
    ]);
    const events = await prisma.learningEvent.count({ where: { eventType: LearningEventType.CourseOrganizationChanged, courseId } });
    expect(events).toBe(2);
  });

  it("khoá hoặc tổ chức không tồn tại thì báo lỗi rõ", async () => {
    const { admin, org, courseId } = await setup();
    await expect(setCourseOrganization(admin, "khong-co", org.id)).rejects.toMatchObject({ code: "course_not_found" });
    await expect(setCourseOrganization(admin, courseId, "khong-co")).rejects.toMatchObject({ code: "org_not_found" });
  });
});
