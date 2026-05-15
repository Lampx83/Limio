import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import {
  addAdminToRound,
  createExamRound,
  deleteExamRound,
  getExamRound,
  listExamRounds,
  removeAdminFromRound,
  updateExamRound,
} from "../exam-rounds";
import { ExamError } from "../types";

const BASE = "http://localhost:3000";

async function newUserCourse(tag: string) {
  const u = await registerUser(
    {
      email: `er-${tag}-${Date.now()}@e.com`,
      password: "password1234",
      displayName: `U-${tag}`,
    },
    BASE,
  );
  const c = await createCourse(u.userId, {
    title: `C ${tag}`,
    description: "x",
    slug: `er-${tag}-${Date.now().toString(36)}`,
  });
  return { userId: u.userId, courseId: c.courseId };
}

describe("A5.3 — createExamRound (1 round = 1 course)", () => {
  it("creates a round bound to one course + auto-adds creator as admin", async () => {
    const { userId, courseId } = await newUserCourse("create");
    const { id } = await createExamRound(userId, {
      code: `RND-${Date.now()}`,
      title: "Đợt thi giữa kỳ",
      opensAt: new Date(Date.now() + 60_000),
      closesAt: new Date(Date.now() + 7 * 86_400_000),
      courseId,
    });
    const detail = await getExamRound(userId, id);
    expect(detail.status).toBe("draft");
    expect(detail.course.courseId).toBe(courseId);
    expect(detail.admins).toHaveLength(1);
    expect(detail.admins[0]!.userId).toBe(userId);
  });

  it("rejects when caller can't edit the course", async () => {
    const a = await newUserCourse("au");
    const b = await newUserCourse("bu");
    await expect(
      createExamRound(a.userId, {
        code: `RND-NG-${Date.now()}`,
        title: "X",
        opensAt: new Date(Date.now() + 60_000),
        closesAt: new Date(Date.now() + 120_000),
        courseId: b.courseId,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects duplicate code (within same course)", async () => {
    const { userId, courseId } = await newUserCourse("dup");
    const code = `RND-DUP-${Date.now()}`;
    await createExamRound(userId, {
      code,
      title: "A",
      opensAt: new Date(Date.now() + 60_000),
      closesAt: new Date(Date.now() + 120_000),
      courseId,
    });
    await expect(
      createExamRound(userId, {
        code,
        title: "B",
        opensAt: new Date(Date.now() + 60_000),
        closesAt: new Date(Date.now() + 120_000),
        courseId,
      }),
    ).rejects.toMatchObject({ code: "round_code_taken" });
  });
});

describe("A5.3 — listExamRounds", () => {
  it("returns rounds the user admins or instructs (excludes unrelated rounds)", async () => {
    const me = await newUserCourse("list-me");
    const other = await newUserCourse("list-other");
    const myRound = await createExamRound(me.userId, {
      code: `RND-ME-${Date.now()}`,
      title: "Mine",
      opensAt: new Date(Date.now() + 60_000),
      closesAt: new Date(Date.now() + 120_000),
      courseId: me.courseId,
    });
    await createExamRound(other.userId, {
      code: `RND-OT-${Date.now()}`,
      title: "Theirs",
      opensAt: new Date(Date.now() + 60_000),
      closesAt: new Date(Date.now() + 120_000),
      courseId: other.courseId,
    });
    const rows = await listExamRounds(me.userId);
    expect(rows.map((r) => r.id)).toContain(myRound.id);
    expect(rows.find((r) => r.title === "Theirs")).toBeUndefined();
  });
});

describe("A5.3 — updateExamRound + status", () => {
  it("admin can update title + status", async () => {
    const { userId, courseId } = await newUserCourse("upd");
    const { id } = await createExamRound(userId, {
      code: `RND-UPD-${Date.now()}`,
      title: "Orig",
      opensAt: new Date(Date.now() + 60_000),
      closesAt: new Date(Date.now() + 120_000),
      courseId,
    });
    await updateExamRound(userId, id, { title: "New", status: "open" });
    const d = await getExamRound(userId, id);
    expect(d.title).toBe("New");
    expect(d.status).toBe("open");
  });

  it("rejects window flip when only one date supplied", async () => {
    const { userId, courseId } = await newUserCourse("flip");
    const { id } = await createExamRound(userId, {
      code: `RND-FLP-${Date.now()}`,
      title: "T",
      opensAt: new Date(Date.now() + 60_000),
      closesAt: new Date(Date.now() + 120_000),
      courseId,
    });
    await expect(
      updateExamRound(userId, id, {
        opensAt: new Date(Date.now() + 200_000),
      }),
    ).rejects.toMatchObject({ code: "round_invalid_window" });
  });
});

describe("A5.3 — admin bridge management", () => {
  it("addAdminToRound + removeAdminFromRound, refuses last admin removal", async () => {
    const me = await newUserCourse("adm-me");
    const co = await registerUser(
      {
        email: `adm-co-${Date.now()}@e.com`,
        password: "password1234",
        displayName: "Co",
      },
      BASE,
    );
    const { id } = await createExamRound(me.userId, {
      code: `RND-ADM-${Date.now()}`,
      title: "T",
      opensAt: new Date(Date.now() + 60_000),
      closesAt: new Date(Date.now() + 120_000),
      courseId: me.courseId,
    });
    await addAdminToRound(me.userId, id, co.userId);
    let d = await getExamRound(me.userId, id);
    expect(d.admins.map((a) => a.userId).sort()).toEqual(
      [me.userId, co.userId].sort(),
    );
    const seen = await listExamRounds(co.userId);
    expect(seen.map((r) => r.id)).toContain(id);

    await removeAdminFromRound(me.userId, id, co.userId);
    d = await getExamRound(me.userId, id);
    expect(d.admins).toHaveLength(1);

    await expect(
      removeAdminFromRound(me.userId, id, me.userId),
    ).rejects.toBeInstanceOf(ExamError);
  });
});

describe("A5.3 — deleteExamRound", () => {
  it("deletes a draft round; refuses if it owns sessions", async () => {
    const { userId, courseId } = await newUserCourse("del");
    const { id } = await createExamRound(userId, {
      code: `RND-DEL-${Date.now()}`,
      title: "T",
      opensAt: new Date(Date.now() + 60_000),
      closesAt: new Date(Date.now() + 120_000),
      courseId,
    });
    await deleteExamRound(userId, id);
    await expect(getExamRound(userId, id)).rejects.toMatchObject({
      code: "round_not_found",
    });
  });
});
