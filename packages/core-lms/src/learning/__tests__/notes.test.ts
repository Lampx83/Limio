import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createNote, deleteNote, listLessonNotes, NoteError } from "../notes";
import { enrollInCourse } from "../enroll";
import { createCourse, publishCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { createSkill, tagLessonSkill } from "../../courses/skills";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const owner = await registerUser(
    { email: `o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const a = await registerUser(
    { email: `a-${slug}@e.com`, password: "password1234", displayName: "A" },
    BASE,
  );
  const b = await registerUser(
    { email: `b-${slug}@e.com`, password: "password1234", displayName: "B" },
    BASE,
  );
  const c = await createCourse(owner.userId, { title: slug, description: "x", slug });
  const m = await createModule(owner.userId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(owner.userId, m.moduleId, { title: "L", orderIndex: 0 });
  const skill = await createSkill({ code: `skill.n.${slug}`, name: "s" });
  await tagLessonSkill(owner.userId, l.lessonId, { skillId: skill.skillId });
  await publishCourse(owner.userId, c.courseId);
  await enrollInCourse(a.userId, c.courseId);
  await enrollInCourse(b.userId, c.courseId);
  return { aId: a.userId, bId: b.userId, lessonId: l.lessonId, courseId: c.courseId };
}

describe("notes", () => {
  it("AC-A3.10: create + list returns user's own notes only", async () => {
    const { aId, bId, lessonId } = await setup("n1");
    await createNote(aId, lessonId, { body: "Alice's note 1", timestampSec: 30 });
    await createNote(aId, lessonId, { body: "Alice's note 2", timestampSec: 90 });
    await createNote(bId, lessonId, { body: "Bob's note" });

    const aNotes = await listLessonNotes(aId, lessonId);
    expect(aNotes).toHaveLength(2);
    expect(aNotes[0]?.body).toBe("Alice's note 1");
    expect(aNotes[1]?.body).toBe("Alice's note 2");
    expect(aNotes.every((n) => n.userId === aId)).toBe(true);

    const bNotes = await listLessonNotes(bId, lessonId);
    expect(bNotes).toHaveLength(1);
    expect(bNotes[0]?.body).toBe("Bob's note");
  });

  it("AC-A3.11: deleting another user's note throws note_not_found (no leak)", async () => {
    const { aId, bId, lessonId } = await setup("n2");
    const note = await createNote(aId, lessonId, { body: "Alice's secret" });
    await expect(deleteNote(bId, note.noteId)).rejects.toMatchObject({
      code: "note_not_found",
    });
    // Note still exists.
    const stillThere = await prisma.note.findUnique({ where: { id: note.noteId } });
    expect(stillThere).not.toBeNull();
  });

  it("create requires enrollment", async () => {
    const { lessonId } = await setup("n3");
    const outsider = await registerUser(
      { email: `outsider-n3@e.com`, password: "password1234", displayName: "X" },
      BASE,
    );
    await expect(
      createNote(outsider.userId, lessonId, { body: "hi" }),
    ).rejects.toMatchObject({ code: "not_enrolled" });
  });

  it("validation: empty body rejected", async () => {
    const { aId, lessonId } = await setup("n4");
    await expect(createNote(aId, lessonId, { body: "   " })).rejects.toBeInstanceOf(NoteError);
  });

  it("delete own note works", async () => {
    const { aId, lessonId } = await setup("n5");
    const note = await createNote(aId, lessonId, { body: "to delete" });
    await deleteNote(aId, note.noteId);
    const list = await listLessonNotes(aId, lessonId);
    expect(list).toHaveLength(0);
  });
});
