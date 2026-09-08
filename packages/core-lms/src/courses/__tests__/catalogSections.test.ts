import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import {
  addCourseToSection,
  createCatalogSection,
  deleteCatalogSection,
  listCatalogSectionsForAdmin,
  listCatalogSectionsForDisplay,
  listCoursesInSection,
  removeCourseFromSection,
  reorderCatalogSections,
  reorderCoursesInSection,
  updateCatalogSection,
} from "../catalogSections";
import { createCourse, publishCourse } from "../courses";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";

const BASE = "http://localhost:3000";

async function makeUser(email: string) {
  const r = await registerUser({ email, password: "password1234", displayName: email }, BASE);
  return r.userId;
}

async function makeAdmin(email: string) {
  const userId = await makeUser(email);
  await grantRole(userId, { targetUserId: userId, roleName: RoleName.Admin });
  return userId;
}

async function publishedCourse(ownerId: string, slug: string) {
  const c = await createCourse(ownerId, { title: `Course ${slug}`, description: "d", slug });
  await publishCourse(ownerId, c.courseId);
  return c.courseId;
}

describe("CatalogSection — permissions", () => {
  it("rejects non-admin actors on every mutation", async () => {
    const learnerId = await makeUser("learner@e.com");
    await expect(
      createCatalogSection(learnerId, { title: "X", type: "MANUAL" }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(listCatalogSectionsForAdmin(learnerId)).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});

describe("CatalogSection — MANUAL", () => {
  it("shows courses in curated order, and reorder changes it", async () => {
    const adminId = await makeAdmin("admin1@e.com");
    const a = await publishedCourse(adminId, "a1");
    const b = await publishedCourse(adminId, "b1");
    const c = await publishedCourse(adminId, "c1");

    const section = await createCatalogSection(adminId, { title: "Nổi bật", type: "MANUAL" });
    await addCourseToSection(adminId, section.id, a);
    await addCourseToSection(adminId, section.id, b);
    await addCourseToSection(adminId, section.id, c);

    let display = await listCatalogSectionsForDisplay();
    expect(display).toHaveLength(1);
    expect(display[0]!.courses.map((x) => x.id)).toEqual([a, b, c]);

    await reorderCoursesInSection(adminId, section.id, [c, a, b]);
    display = await listCatalogSectionsForDisplay();
    expect(display[0]!.courses.map((x) => x.id)).toEqual([c, a, b]);

    const admin = await listCoursesInSection(adminId, section.id);
    expect(admin.map((x) => x.id)).toEqual([c, a, b]);
  });

  it("hides an unpublished course from display without dropping the link", async () => {
    const adminId = await makeAdmin("admin2@e.com");
    const a = await publishedCourse(adminId, "a2");
    const b = await publishedCourse(adminId, "b2");
    const section = await createCatalogSection(adminId, { title: "Nổi bật", type: "MANUAL" });
    await addCourseToSection(adminId, section.id, a);
    await addCourseToSection(adminId, section.id, b);

    await prisma.course.update({ where: { id: a }, data: { status: "draft" } });

    const display = await listCatalogSectionsForDisplay();
    expect(display[0]!.courses.map((x) => x.id)).toEqual([b]);

    // Link row untouched — re-publishing brings it back with no re-curation.
    const links = await prisma.catalogSectionCourse.count({ where: { sectionId: section.id } });
    expect(links).toBe(2);
  });

  it("removeCourseFromSection drops the link entirely", async () => {
    const adminId = await makeAdmin("admin3@e.com");
    const a = await publishedCourse(adminId, "a3");
    const section = await createCatalogSection(adminId, { title: "Nổi bật", type: "MANUAL" });
    await addCourseToSection(adminId, section.id, a);
    await removeCourseFromSection(adminId, section.id, a);

    const links = await prisma.catalogSectionCourse.count({ where: { sectionId: section.id } });
    expect(links).toBe(0);
  });
});

describe("CatalogSection — AUTO_RECENT", () => {
  it("auto-picks the N most recently published courses, no curation needed", async () => {
    const adminId = await makeAdmin("admin4@e.com");
    await publishedCourse(adminId, "a4");
    const b = await publishedCourse(adminId, "b4");
    const c = await publishedCourse(adminId, "c4");

    await createCatalogSection(adminId, {
      title: "Mới xuất bản",
      type: "AUTO_RECENT",
      autoLimit: 2,
    });

    const display = await listCatalogSectionsForDisplay();
    expect(display).toHaveLength(1);
    // most-recent-first, only top 2 of the 3 published courses.
    expect(display[0]!.courses.map((x) => x.id)).toEqual([c, b]);
  });
});

describe("CatalogSection — display fallback", () => {
  it("returns [] when there is no active section, or every section is empty", async () => {
    expect(await listCatalogSectionsForDisplay()).toEqual([]);

    const adminId = await makeAdmin("admin5@e.com");
    const section = await createCatalogSection(adminId, { title: "Rỗng", type: "MANUAL" });
    expect(await listCatalogSectionsForDisplay()).toEqual([]);

    await updateCatalogSection(adminId, section.id, { isActive: false });
    const a = await publishedCourse(adminId, "a5");
    await addCourseToSection(adminId, section.id, a);
    // Still inactive → still excluded even though it now has a course.
    expect(await listCatalogSectionsForDisplay()).toEqual([]);
  });

  it("reorderCatalogSections controls the section display order", async () => {
    const adminId = await makeAdmin("admin6@e.com");
    const a = await publishedCourse(adminId, "a6");
    const b = await publishedCourse(adminId, "b6");
    const s1 = await createCatalogSection(adminId, { title: "S1", type: "MANUAL" });
    const s2 = await createCatalogSection(adminId, { title: "S2", type: "MANUAL" });
    await addCourseToSection(adminId, s1.id, a);
    await addCourseToSection(adminId, s2.id, b);

    await reorderCatalogSections(adminId, [s2.id, s1.id]);
    const display = await listCatalogSectionsForDisplay();
    expect(display.map((s) => s.id)).toEqual([s2.id, s1.id]);
  });
});

describe("CatalogSection — admin CRUD", () => {
  it("deleteCatalogSection cascades its course links", async () => {
    const adminId = await makeAdmin("admin7@e.com");
    const a = await publishedCourse(adminId, "a7");
    const section = await createCatalogSection(adminId, { title: "S", type: "MANUAL" });
    await addCourseToSection(adminId, section.id, a);

    await deleteCatalogSection(adminId, section.id);

    await expect(listCoursesInSection(adminId, section.id)).resolves.toEqual([]);
    const links = await prisma.catalogSectionCourse.count({ where: { sectionId: section.id } });
    expect(links).toBe(0);
  });

  it("rejects adding a course to an AUTO_RECENT section", async () => {
    const adminId = await makeAdmin("admin8@e.com");
    const a = await publishedCourse(adminId, "a8");
    const section = await createCatalogSection(adminId, {
      title: "Auto",
      type: "AUTO_RECENT",
    });
    await expect(addCourseToSection(adminId, section.id, a)).rejects.toMatchObject({
      code: "validation_failed",
    });
  });
});
