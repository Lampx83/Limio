import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../register";
import { exportProfile } from "../profile";
import { createCourse } from "../../courses/courses";
import { enrollInCourse } from "../../learning/enroll";
import { createCourseTeam } from "../../teams/teams";

/** Nộp theo nhóm (AC E2) — nhóm đang tham gia nằm trong bản xuất dữ liệu cá nhân. */
describe("exportProfile — nhóm của khoá", () => {
  it("có tên nhóm, khoá học và thời điểm vào nhóm", async () => {
    const reg = (n: string) =>
      registerUser({ email: `${n}-${Date.now()}-${Math.random()}@e.com`, password: "password1234", displayName: n }, "http://localhost:3000");
    const inst = await reg("inst");
    const lr = await reg("lr");
    const c = await createCourse(inst.userId, { title: "Khoá nhóm", description: "x" });
    await prisma.course.update({ where: { id: c.courseId }, data: { status: "published" } });
    await enrollInCourse(lr.userId, c.courseId);
    await createCourseTeam(lr.userId, c.courseId, "Nhóm Mây");
    const out = await exportProfile(lr.userId);
    expect(out.courseTeamMemberships).toHaveLength(1);
    expect(out.courseTeamMemberships[0]!.team.name).toBe("Nhóm Mây");
    expect(out.courseTeamMemberships[0]!.team.course.title).toBe("Khoá nhóm");
  });
});
