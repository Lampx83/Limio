import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { CourseAuthzError, canEditCourse } from "../authz";
import { createCourse } from "../courses";
import { createCourseSection, deleteCourseSection, listCourseSections, transferEnrollmentSection, updateCourseSection } from "../sections";
import { updateCohort } from "../../exam/cohorts";
import { cancelMeeting, setClassSchedule } from "../classSchedule";
import { getTeachingScope, isOrgAdminOfCourse } from "../teachingScope";
import { addCoInstructorByEmail } from "../instructors";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";

async function makeUser(tag: string, email: string) {
  return (await registerUser({ email: `oac-${tag}-${email}@e.com`, password: "password1234", displayName: email }, BASE)).userId;
}

/** Khoá của chủ khoá thuộc một trường; một OrgAdmin của trường đó, một OrgAdmin của trường khác, một người lạ. */
async function setup(tag: string) {
  const owner = await makeUser(tag, "owner");
  const orgAdmin = await makeUser(tag, "oa");
  const foreignAdmin = await makeUser(tag, "fa");
  const stranger = await makeUser(tag, "x");
  const org = await prisma.organization.create({ data: { code: `OAC-${randomUUID().slice(0, 8)}`, name: "Trung tâm", centerEnabled: true } });
  const other = await prisma.organization.create({ data: { code: `OAC2-${randomUUID().slice(0, 8)}`, name: "Trung tâm khác", centerEnabled: true } });
  await prisma.organizationAdmin.create({ data: { organizationId: org.id, userId: orgAdmin } });
  await prisma.organizationAdmin.create({ data: { organizationId: other.id, userId: foreignAdmin } });
  const { courseId } = await createCourse(owner, { title: "HSK 1", description: "Khoá thử.", slug: `oac-${tag}-${randomUUID().slice(0, 6)}` });
  await prisma.course.update({ where: { id: courseId }, data: { organizationId: org.id } });
  return { owner, orgAdmin, foreignAdmin, stranger, courseId, org };
}

describe("OrgAdmin xếp lớp trong khoá thuộc trường của mình", () => {
  it("là `manage` của khoá thuộc trường mình, nhưng không sửa được nội dung khoá", async () => {
    const s = await setup("scope");
    expect(await getTeachingScope(s.orgAdmin, s.courseId)).toBe("manage");
    expect(await isOrgAdminOfCourse(s.orgAdmin, s.courseId)).toBe(true);
    expect(await canEditCourse(s.orgAdmin, s.courseId)).toBe(false);
  });

  it("OrgAdmin trường khác và người lạ không có quyền nào", async () => {
    const s = await setup("deny");
    expect(await getTeachingScope(s.foreignAdmin, s.courseId)).toBeNull();
    expect(await getTeachingScope(s.stranger, s.courseId)).toBeNull();
    await expect(createCourseSection(s.foreignAdmin, s.courseId, { name: "Lớp lén" })).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(listCourseSections(s.stranger, s.courseId)).rejects.toBeInstanceOf(CourseAuthzError);
  });

  it("khoá không thuộc trường nào thì OrgAdmin không có quyền", async () => {
    const s = await setup("noorg");
    await prisma.course.update({ where: { id: s.courseId }, data: { organizationId: null } });
    expect(await isOrgAdminOfCourse(s.orgAdmin, s.courseId)).toBe(false);
    await expect(createCourseSection(s.orgAdmin, s.courseId, { name: "Lớp" })).rejects.toBeInstanceOf(CourseAuthzError);
  });

  it("tạo, đổi tên, xoá lớp và đặt lịch, huỷ buổi", async () => {
    const s = await setup("crud");
    const section = await createCourseSection(s.orgAdmin, s.courseId, { name: "Lớp tối T3-T5" });
    expect((await listCourseSections(s.orgAdmin, s.courseId)).map((x) => x.id)).toContain(section.id);
    await updateCourseSection(s.orgAdmin, section.id, { name: "Lớp tối T3-T5 (mới)" });
    const teacher = await makeUser("crud", "gv");
    await updateCohort(s.orgAdmin, section.id, { instructorId: teacher });
    const row = await prisma.courseSection.findUniqueOrThrow({ where: { id: section.id } });
    expect(row.instructorId).toBe(teacher);

    await setClassSchedule(
      s.orgAdmin,
      section.id,
      { startDate: "2026-12-01", totalMeetings: 2, slots: [{ weekday: 2, startTime: "18:30", durationMin: 120 }] },
      prisma,
      new Date("2026-11-20T03:00:00.000Z"),
    );
    const meeting = await prisma.classMeeting.findFirstOrThrow({ where: { sectionId: section.id }, orderBy: { startsAt: "asc" } });
    await cancelMeeting(s.orgAdmin, meeting.id, { reason: "Nghỉ lễ" });

    await deleteCourseSection(s.orgAdmin, section.id);
    expect(await prisma.courseSection.findUnique({ where: { id: section.id } })).toBeNull();
  });

  it("chuyển học viên giữa hai lớp; người lạ thì không", async () => {
    const s = await setup("move");
    const a = await createCourseSection(s.owner, s.courseId, { name: "Lớp A" });
    const b = await createCourseSection(s.owner, s.courseId, { name: "Lớp B" });
    const learner = await makeUser("move", "hv");
    const enr = await prisma.enrollment.create({ data: { courseId: s.courseId, userId: learner, sectionId: a.id, status: "active", courseVersion: 1 } });
    await expect(transferEnrollmentSection(s.stranger, enr.id, b.id)).rejects.toBeInstanceOf(CourseAuthzError);
    await transferEnrollmentSection(s.orgAdmin, enr.id, b.id);
    expect((await prisma.enrollment.findUniqueOrThrow({ where: { id: enr.id } })).sectionId).toBe(b.id);
  });

  it("thêm giáo viên bằng email vẫn được; trợ giảng của khoá không quản được nhân sự", async () => {
    const s = await setup("inst");
    const gv = await makeUser("inst", "gv");
    const ta = await makeUser("inst", "ta");
    await prisma.courseInstructor.create({ data: { courseId: s.courseId, userId: ta, role: "teaching-assistant" } });
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: gv }, select: { email: true } })).email;
    const r = await addCoInstructorByEmail(s.orgAdmin, s.courseId, email, "non-editing-teacher", BASE);
    expect(r.userId).toBe(gv);
    await expect(addCoInstructorByEmail(ta, s.courseId, email, "co-instructor", BASE)).rejects.toBeInstanceOf(CourseAuthzError);
  });
});
