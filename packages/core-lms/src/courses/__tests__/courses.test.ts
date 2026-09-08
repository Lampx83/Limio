import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import {
  archiveCourse,
  bumpCourseVersion,
  CourseAuthzError,
  CourseError,
  createCourse,
  getCourseDetail,
  listPublishedCourses,
  publishCourse,
  updateCourse,
} from "../courses";
import { createSkill, tagLessonSkill } from "../skills";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";

const BASE = "http://localhost:3000";

async function makeUser(email: string) {
  const r = await registerUser({ email, password: "password1234", displayName: email }, BASE);
  return r.userId;
}

async function buildCourseTree(
  ownerId: string,
  slugBase = "demo",
  personalizationEnabled = true,
) {
  const c = await createCourse(ownerId, {
    title: "Demo course",
    description: "A demo course for testing.",
    slug: slugBase,
    personalizationEnabled,
  });
  const m = await createModule(ownerId, c.courseId, { title: "M1", orderIndex: 0 });
  const l1 = await createLesson(ownerId, m.moduleId, { title: "L1", orderIndex: 0 });
  const l2 = await createLesson(ownerId, m.moduleId, { title: "L2", orderIndex: 1 });
  return { courseId: c.courseId, moduleId: m.moduleId, lessonIds: [l1.lessonId, l2.lessonId] };
}

describe("createCourse", () => {
  it("AC-A2.1: creates draft course + owner CourseInstructor + auto-grants instructor role", async () => {
    const userId = await makeUser("teacher@example.com");
    const before = await prisma.userRole.findFirst({
      where: { userId, role: { name: RoleName.Instructor } },
    });
    expect(before).toBeNull();

    const result = await createCourse(userId, {
      title: "Intro to BKT",
      description: "Bayesian Knowledge Tracing fundamentals",
    });

    const course = await prisma.course.findUniqueOrThrow({
      where: { id: result.courseId },
      include: { instructors: true },
    });
    expect(course.status).toBe("draft");
    expect(course.version).toBe(1);
    expect(course.slug).toBe("intro-to-bkt");
    expect(course.instructors).toHaveLength(1);
    expect(course.instructors[0]?.userId).toBe(userId);
    expect(course.instructors[0]?.role).toBe("owner");

    const after = await prisma.userRole.findFirst({
      where: { userId, role: { name: RoleName.Instructor } },
    });
    expect(after).not.toBeNull();

    const audits = await prisma.auditLog.findMany({ where: { actorUserId: userId } });
    const actions = audits.map((a) => a.action);
    expect(actions).toContain("course.created");
    expect(actions).toContain("role.granted");
  });

  it("auto-generates unique slug on collision (-2, -3)", async () => {
    const userId = await makeUser("t1@example.com");
    const a = await createCourse(userId, { title: "Same title", description: "x" });
    const b = await createCourse(userId, { title: "Same title", description: "x" });
    const c = await createCourse(userId, { title: "Same title", description: "x" });
    const slugs = await prisma.course.findMany({
      where: { id: { in: [a.courseId, b.courseId, c.courseId] } },
      select: { slug: true },
    });
    expect(slugs.map((s) => s.slug).sort()).toEqual(["same-title", "same-title-2", "same-title-3"]);
  });

  it("validates input (empty title)", async () => {
    const userId = await makeUser("t2@example.com");
    await expect(createCourse(userId, { title: "", description: "x" })).rejects.toMatchObject({
      code: "validation_failed",
    });
  });
});

describe("publish flow", () => {
  it("AC-B1.5-3.1: publish backfills the missing tag instead of rejecting", async () => {
    const ownerId = await makeUser("o1@example.com");
    const { courseId, lessonIds } = await buildCourseTree(ownerId, "p1");
    await updateCourse(ownerId, courseId, { personalizationEnabled: true });
    // Hand-tag l1 only; l2 relies on its auto tag.
    const s = await createSkill({ code: "skill.x", name: "X" });
    await tagLessonSkill(ownerId, lessonIds[0]!, { skillId: s.skillId });

    await publishCourse(ownerId, courseId);

    const c = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    expect(c.status).toBe("published");
    for (const lessonId of lessonIds) {
      const tags = await prisma.contentSkillMapping.count({
        where: { contentType: "lesson", contentId: lessonId },
      });
      expect(tags).toBeGreaterThan(0);
    }
  });

  it("AC-A2.7: publishes when all lessons tagged (personalization on)", async () => {
    const ownerId = await makeUser("o2@example.com");
    const { courseId, lessonIds } = await buildCourseTree(ownerId, "p2");
    await updateCourse(ownerId, courseId, { personalizationEnabled: true });
    const s = await createSkill({ code: "skill.y", name: "Y" });
    for (const lid of lessonIds) {
      await tagLessonSkill(ownerId, lid, { skillId: s.skillId });
    }
    await publishCourse(ownerId, courseId);
    const c = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    expect(c.status).toBe("published");
    expect(c.publishedAt).toBeInstanceOf(Date);
  });

  it("personalization off: publishes despite untagged lessons", async () => {
    const ownerId = await makeUser("o-perso-off@example.com");
    const { courseId } = await buildCourseTree(ownerId, "p-perso-off", false);
    // Plain LMS course — no skill tags, none auto-provisioned. Should publish.
    await publishCourse(ownerId, courseId);
    const c = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    expect(c.status).toBe("published");
    expect(c.personalizationEnabled).toBe(false);
  });

  it("toggling personalizationEnabled writes audit log", async () => {
    const ownerId = await makeUser("o-toggle@example.com");
    const c = await createCourse(ownerId, {
      title: "Toggle test",
      description: "x",
      personalizationEnabled: false,
    });
    await updateCourse(ownerId, c.courseId, { personalizationEnabled: true });
    const entry = await prisma.auditLog.findFirst({
      where: { action: "course.personalization.toggled" },
      orderBy: { occurredAt: "desc" },
    });
    expect(entry).not.toBeNull();
    expect((entry!.payload as { from: boolean; to: boolean }).from).toBe(false);
    expect((entry!.payload as { from: boolean; to: boolean }).to).toBe(true);
  });

  it("publicAccess defaults to false on create", async () => {
    const ownerId = await makeUser("o-public-default@example.com");
    const c = await createCourse(ownerId, { title: "Public default", description: "x" });
    const row = await prisma.course.findUniqueOrThrow({ where: { id: c.courseId } });
    expect(row.publicAccess).toBe(false);
  });

  it("toggling publicAccess writes audit log", async () => {
    const ownerId = await makeUser("o-public-toggle@example.com");
    const c = await createCourse(ownerId, { title: "Public toggle", description: "x" });
    await updateCourse(ownerId, c.courseId, { publicAccess: true });
    const row = await prisma.course.findUniqueOrThrow({ where: { id: c.courseId } });
    expect(row.publicAccess).toBe(true);
    const entry = await prisma.auditLog.findFirst({
      where: { action: "course.public_access.toggled" },
      orderBy: { occurredAt: "desc" },
    });
    expect(entry).not.toBeNull();
    expect((entry!.payload as { from: boolean; to: boolean }).from).toBe(false);
    expect((entry!.payload as { from: boolean; to: boolean }).to).toBe(true);
  });

  it("re-saving publicAccess unchanged writes no audit log", async () => {
    const ownerId = await makeUser("o-public-noop@example.com");
    const c = await createCourse(ownerId, { title: "Public noop", description: "x" });
    await updateCourse(ownerId, c.courseId, { publicAccess: false });
    const entry = await prisma.auditLog.findFirst({
      where: { action: "course.public_access.toggled", payload: { path: ["courseId"], equals: c.courseId } },
    });
    expect(entry).toBeNull();
  });

  it("toggling both flags at once audits each independently", async () => {
    const ownerId = await makeUser("o-both-flags@example.com");
    const c = await createCourse(ownerId, {
      title: "Both flags",
      description: "x",
      personalizationEnabled: false,
    });
    await updateCourse(ownerId, c.courseId, {
      personalizationEnabled: true,
      publicAccess: true,
    });
    const row = await prisma.course.findUniqueOrThrow({ where: { id: c.courseId } });
    expect(row.personalizationEnabled).toBe(true);
    expect(row.publicAccess).toBe(true);
    for (const action of ["course.personalization.toggled", "course.public_access.toggled"]) {
      const entry = await prisma.auditLog.findFirst({
        where: { action, payload: { path: ["courseId"], equals: c.courseId } },
      });
      expect(entry, `missing audit for ${action}`).not.toBeNull();
    }
  });

  it("chuyển sang invite_only xoá giá — link mời không có nơi nào để trả tiền", async () => {
    const ownerId = await makeUser("o-invite-price@example.com");
    const c = await createCourse(ownerId, { title: "Invite price", description: "x" });
    await updateCourse(ownerId, c.courseId, { priceCents: 199_000, currency: "VND" });
    let row = await prisma.course.findUniqueOrThrow({ where: { id: c.courseId } });
    expect(row.priceCents).toBe(199_000);

    await updateCourse(ownerId, c.courseId, { enrollMode: "invite_only" });
    row = await prisma.course.findUniqueOrThrow({ where: { id: c.courseId } });
    expect(row.priceCents).toBeNull();
  });

  it("đặt giá và invite_only trong cùng một lần gọi vẫn ưu tiên xoá giá", async () => {
    const ownerId = await makeUser("o-invite-price-same-call@example.com");
    const c = await createCourse(ownerId, { title: "Invite price same call", description: "x" });

    await updateCourse(ownerId, c.courseId, {
      priceCents: 250_000,
      enrollMode: "invite_only",
    });
    const row = await prisma.course.findUniqueOrThrow({ where: { id: c.courseId } });
    expect(row.priceCents).toBeNull();
    expect(row.enrollMode).toBe("invite_only");
  });

  it("khoá invite_only từ trước, chỉ sửa giá mà không đổi enrollMode, vẫn bị ép về null", async () => {
    const ownerId = await makeUser("o-invite-already@example.com");
    const c = await createCourse(ownerId, { title: "Invite already", description: "x" });
    await updateCourse(ownerId, c.courseId, { enrollMode: "invite_only" });

    await updateCourse(ownerId, c.courseId, { priceCents: 50_000 });
    const row = await prisma.course.findUniqueOrThrow({ where: { id: c.courseId } });
    expect(row.priceCents).toBeNull();
  });

  it("khoá open đặt giá bình thường, không đụng tới trường không liên quan", async () => {
    const ownerId = await makeUser("o-open-price@example.com");
    const c = await createCourse(ownerId, { title: "Open price", description: "x" });
    await updateCourse(ownerId, c.courseId, { priceCents: 99_000, currency: "VND" });
    const row = await prisma.course.findUniqueOrThrow({ where: { id: c.courseId } });
    expect(row.priceCents).toBe(99_000);
    expect(row.enrollMode).toBe("open");
  });

  it("rejects publish on archived course", async () => {
    const ownerId = await makeUser("o3@example.com");
    const { courseId } = await buildCourseTree(ownerId, "p3");
    await prisma.course.update({ where: { id: courseId }, data: { status: "archived" } });
    await expect(publishCourse(ownerId, courseId)).rejects.toMatchObject({
      code: "invalid_status_transition",
    });
  });
});

describe("authorization", () => {
  it("AC-A2.13: non-owner non-admin gets forbidden on update/archive", async () => {
    const ownerId = await makeUser("owner@example.com");
    const otherId = await makeUser("other@example.com");
    const c = await createCourse(ownerId, { title: "Auth test", description: "x" });
    await expect(updateCourse(otherId, c.courseId, { title: "Hijacked" })).rejects.toBeInstanceOf(
      CourseAuthzError,
    );
    await expect(archiveCourse(otherId, c.courseId)).rejects.toBeInstanceOf(CourseAuthzError);
  });

  it("admin can edit any course", async () => {
    const ownerId = await makeUser("ow2@example.com");
    const adminId = await makeUser("admin@example.com");
    await grantRole(adminId, { targetUserId: adminId, roleName: RoleName.Admin });
    const c = await createCourse(ownerId, { title: "Admin reach", description: "x" });
    await expect(updateCourse(adminId, c.courseId, { title: "Edited by admin" })).resolves.toBeUndefined();
    const course = await prisma.course.findUniqueOrThrow({ where: { id: c.courseId } });
    expect(course.title).toBe("Edited by admin");
  });
});

describe("archive + version", () => {
  it("AC-A2.8: bumpCourseVersion increments version", async () => {
    const ownerId = await makeUser("v1@example.com");
    const c = await createCourse(ownerId, { title: "V test", description: "x" });
    expect((await bumpCourseVersion(ownerId, c.courseId)).version).toBe(2);
    expect((await bumpCourseVersion(ownerId, c.courseId)).version).toBe(3);
  });

  it("AC-A2.9: archive sets status, idempotent", async () => {
    const ownerId = await makeUser("a1@example.com");
    const c = await createCourse(ownerId, { title: "A test", description: "x" });
    await archiveCourse(ownerId, c.courseId);
    await archiveCourse(ownerId, c.courseId); // idempotent
    const got = await prisma.course.findUniqueOrThrow({ where: { id: c.courseId } });
    expect(got.status).toBe("archived");
  });
});

describe("catalog & detail", () => {
  it("AC-A2.10: catalog only returns published courses; supports text search", async () => {
    const ownerId = await makeUser("cat1@example.com");
    const a = await createCourse(ownerId, {
      title: "Algebra basics",
      description: "Learn algebra",
      slug: "algebra",
    });
    const b = await createCourse(ownerId, {
      title: "Calculus",
      description: "Hard math",
      slug: "calc",
    });
    // Tag + publish only `a`.
    const m = await createModule(ownerId, a.courseId, { title: "M", orderIndex: 0 });
    const l = await createLesson(ownerId, m.moduleId, { title: "L", orderIndex: 0 });
    const s = await createSkill({ code: "math.algebra", name: "Algebra" });
    await tagLessonSkill(ownerId, l.lessonId, { skillId: s.skillId });
    await publishCourse(ownerId, a.courseId);

    const all = await listPublishedCourses({});
    expect(all.items.map((c) => c.id)).toEqual([a.courseId]);
    expect(all.items.some((c) => c.id === b.courseId)).toBe(false);

    const search = await listPublishedCourses({ q: "algebra" });
    expect(search.items).toHaveLength(1);
    const noMatch = await listPublishedCourses({ q: "xyz" });
    expect(noMatch.items).toHaveLength(0);
  });

  it("AC-A2.11: getCourseDetail returns 404 for unpublished if not editor", async () => {
    const ownerId = await makeUser("d1@example.com");
    const otherId = await makeUser("d2@example.com");
    const c = await createCourse(ownerId, { title: "Hidden", description: "x", slug: "hidden" });
    // Unauthenticated: not_found
    await expect(getCourseDetail("hidden", null)).rejects.toMatchObject({ code: "not_found" });
    // Other user: not_found (no leak)
    await expect(getCourseDetail("hidden", otherId)).rejects.toMatchObject({ code: "not_found" });
    // Owner: visible
    const seen = await getCourseDetail("hidden", ownerId);
    expect(seen.id).toBe(c.courseId);
  });
});
