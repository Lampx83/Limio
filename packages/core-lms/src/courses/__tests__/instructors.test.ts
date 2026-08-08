import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  addCoInstructorByEmail,
  listCourseInstructors,
  removeCoInstructor,
} from "../instructors";
import { CourseAuthzError } from "../authz";
import { createCourse, CourseError } from "../courses";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";

async function makeUser(email: string) {
  const r = await registerUser(
    { email, password: "password1234", displayName: email },
    BASE,
  );
  return r.userId;
}

async function makeCourse(ownerId: string, slugBase: string) {
  const c = await createCourse(ownerId, {
    title: "Demo course",
    description: "A demo course for testing.",
    slug: slugBase,
  });
  return c.courseId;
}

describe("addCoInstructorByEmail", () => {
  it("AC: existing account is attached immediately, invited=false", async () => {
    const ownerId = await makeUser("owner1@example.com");
    const courseId = await makeCourse(ownerId, "co1");
    const coId = await makeUser("co1@example.com");

    const r = await addCoInstructorByEmail(
      ownerId,
      courseId,
      "co1@example.com",
      "co-instructor",
      BASE,
    );
    expect(r.invited).toBe(false);
    expect(r.userId).toBe(coId);

    const row = await prisma.courseInstructor.findUniqueOrThrow({
      where: { courseId_userId: { courseId, userId: coId } },
    });
    expect(row.role).toBe("co-instructor");

    const events = await prisma.learningEvent.findMany({
      where: { courseId, eventType: LearningEventType.CourseInstructorAdded },
    });
    expect(events).toHaveLength(1);
  });

  it("AC: unregistered email gets a no-password account created, invited=true", async () => {
    const ownerId = await makeUser("owner2@example.com");
    const courseId = await makeCourse(ownerId, "co2");

    const r = await addCoInstructorByEmail(
      ownerId,
      courseId,
      "brandnew@example.com",
      "co-instructor",
      BASE,
    );
    expect(r.invited).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: r.userId } });
    expect(user.email).toBe("brandnew@example.com");
    expect(user.passwordHash).toBeNull();

    const row = await prisma.courseInstructor.findUniqueOrThrow({
      where: { courseId_userId: { courseId, userId: r.userId } },
    });
    expect(row.role).toBe("co-instructor");
  });

  it("AC: adding the same email twice is idempotent — no duplicate row", async () => {
    const ownerId = await makeUser("owner3@example.com");
    const courseId = await makeCourse(ownerId, "co3");
    await makeUser("dup@example.com");

    await addCoInstructorByEmail(ownerId, courseId, "dup@example.com", "co-instructor", BASE);
    await addCoInstructorByEmail(ownerId, courseId, "dup@example.com", "co-instructor", BASE);

    const rows = await prisma.courseInstructor.findMany({ where: { courseId } });
    // owner + the one co-instructor, not two.
    expect(rows).toHaveLength(2);
  });

  it("AC: rejects invalid email format", async () => {
    const ownerId = await makeUser("owner4@example.com");
    const courseId = await makeCourse(ownerId, "co4");

    await expect(
      addCoInstructorByEmail(ownerId, courseId, "not-an-email", "co-instructor", BASE),
    ).rejects.toThrow(CourseError);
  });

  it("AC: rejects an unknown role value", async () => {
    const ownerId = await makeUser("owner4b@example.com");
    const courseId = await makeCourse(ownerId, "co4b");

    await expect(
      addCoInstructorByEmail(ownerId, courseId, "x@example.com", "super-admin", BASE),
    ).rejects.toThrow(CourseError);
  });

  it("AC: a co-instructor (non-owner) cannot add another co-instructor", async () => {
    const ownerId = await makeUser("owner5@example.com");
    const courseId = await makeCourse(ownerId, "co5");
    const coId = await makeUser("co5@example.com");
    await addCoInstructorByEmail(ownerId, courseId, "co5@example.com", "co-instructor", BASE);
    await makeUser("target5@example.com");

    await expect(
      addCoInstructorByEmail(coId, courseId, "target5@example.com", "co-instructor", BASE),
    ).rejects.toThrow(CourseAuthzError);
  });

  it("AC: assigns non-editing-teacher and teaching-assistant roles correctly", async () => {
    const ownerId = await makeUser("owner5c@example.com");
    const courseId = await makeCourse(ownerId, "co5c");
    const netId = await makeUser("net5c@example.com");
    const taId = await makeUser("ta5c@example.com");

    await addCoInstructorByEmail(ownerId, courseId, "net5c@example.com", "non-editing-teacher", BASE);
    await addCoInstructorByEmail(ownerId, courseId, "ta5c@example.com", "teaching-assistant", BASE);

    const netRow = await prisma.courseInstructor.findUniqueOrThrow({
      where: { courseId_userId: { courseId, userId: netId } },
    });
    const taRow = await prisma.courseInstructor.findUniqueOrThrow({
      where: { courseId_userId: { courseId, userId: taId } },
    });
    expect(netRow.role).toBe("non-editing-teacher");
    expect(taRow.role).toBe("teaching-assistant");
  });

  it("AC: cannot change the owner's own role through this path", async () => {
    const ownerId = await makeUser("owner5d@example.com");
    const courseId = await makeCourse(ownerId, "co5d");

    await expect(
      addCoInstructorByEmail(ownerId, courseId, "owner5d@example.com", "teaching-assistant", BASE),
    ).rejects.toThrow(CourseError);

    const row = await prisma.courseInstructor.findUniqueOrThrow({
      where: { courseId_userId: { courseId, userId: ownerId } },
    });
    expect(row.role).toBe("owner");
  });
});

describe("removeCoInstructor", () => {
  it("AC: owner removes a co-instructor", async () => {
    const ownerId = await makeUser("owner6@example.com");
    const courseId = await makeCourse(ownerId, "co6");
    const coId = await makeUser("co6@example.com");
    await addCoInstructorByEmail(ownerId, courseId, "co6@example.com", "co-instructor", BASE);

    await removeCoInstructor(ownerId, courseId, coId);

    const row = await prisma.courseInstructor.findUnique({
      where: { courseId_userId: { courseId, userId: coId } },
    });
    expect(row).toBeNull();

    const events = await prisma.learningEvent.findMany({
      where: { courseId, eventType: LearningEventType.CourseInstructorRemoved },
    });
    expect(events).toHaveLength(1);
  });

  it("AC: cannot remove the owner row through this path", async () => {
    const ownerId = await makeUser("owner7@example.com");
    const courseId = await makeCourse(ownerId, "co7");

    await expect(removeCoInstructor(ownerId, courseId, ownerId)).rejects.toThrow(
      CourseError,
    );
  });

  it("AC: a non-owner cannot remove anyone", async () => {
    const ownerId = await makeUser("owner8@example.com");
    const courseId = await makeCourse(ownerId, "co8");
    const coId = await makeUser("co8@example.com");
    await addCoInstructorByEmail(ownerId, courseId, "co8@example.com", "co-instructor", BASE);

    await expect(removeCoInstructor(coId, courseId, coId)).rejects.toThrow(
      CourseAuthzError,
    );
  });

  it("AC: removing an unattached userId throws instructor_not_found", async () => {
    const ownerId = await makeUser("owner9@example.com");
    const courseId = await makeCourse(ownerId, "co9");
    const strangerId = await makeUser("stranger9@example.com");

    await expect(
      removeCoInstructor(ownerId, courseId, strangerId),
    ).rejects.toThrow(CourseError);
  });
});

describe("listCourseInstructors", () => {
  it("AC: returns owner first, then co-instructors", async () => {
    const ownerId = await makeUser("owner10@example.com");
    const courseId = await makeCourse(ownerId, "co10");
    await makeUser("co10@example.com");
    await addCoInstructorByEmail(ownerId, courseId, "co10@example.com", "co-instructor", BASE);

    const rows = await listCourseInstructors(courseId);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.role).toBe("owner");
    expect(rows[1]?.role).toBe("co-instructor");
  });
});
