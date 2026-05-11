import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { CourseAuthzError } from "../../courses/authz";
import {
  createExam,
  createImageAsset,
  createPassage,
  deletePassage,
  ExamError,
  publishExam,
  reorderPassages,
  updatePassage,
} from "../";

const BASE = "http://localhost:3000";

async function newOwner(slug: string) {
  const u = await registerUser(
    { email: `po-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const c = await createCourse(u.userId, {
    title: `Passage course ${slug}`,
    description: "x",
    slug: `passage-course-${slug}`,
  });
  return { ownerId: u.userId, courseId: c.courseId };
}

function validExam(overrides: Partial<Record<string, unknown>> = {}) {
  const now = Date.now();
  return {
    title: "Reading Exam",
    durationMin: 60,
    openAt: new Date(now + 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
    ...overrides,
  };
}

function emptyDoc() {
  return { type: "doc" as const, content: [] };
}

describe("createPassage (A7.2.1)", () => {
  it("creates passage with defaults; orderIndex appended", async () => {
    const { ownerId, courseId } = await newOwner("c1");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const a = await createPassage(ownerId, examId, {
      title: "Part 1",
      contentJson: emptyDoc(),
    });
    const b = await createPassage(ownerId, examId, {
      title: "Part 2",
      contentJson: emptyDoc(),
    });
    const rows = await prisma.examPassage.findMany({
      where: { examId },
      orderBy: { orderIndex: "asc" },
    });
    expect(rows.map((r) => r.id)).toEqual([a.passageId, b.passageId]);
    expect(rows[0]!.orderIndex).toBe(0);
    expect(rows[1]!.orderIndex).toBe(1);
    expect(rows[0]!.audioPolicy).toBe("free_replay");
    expect(rows[0]!.revealMode).toBe("all_at_once");
  });

  it("attaches skillTags when provided", async () => {
    const { ownerId, courseId } = await newOwner("c2");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const skill = await prisma.skill.create({
      data: { code: "exam.passage.skill.c2", name: "S" },
    });
    const { passageId } = await createPassage(ownerId, examId, {
      title: "P",
      contentJson: emptyDoc(),
      skillIds: [skill.id],
    });
    const tags = await prisma.examPassageSkillTag.findMany({
      where: { passageId },
    });
    expect(tags).toHaveLength(1);
    expect(tags[0]!.skillId).toBe(skill.id);
  });

  it("rejects when audioPolicy=limited_replay but maxAudioPlays missing", async () => {
    const { ownerId, courseId } = await newOwner("c3");
    const { examId } = await createExam(ownerId, courseId, validExam());
    await expect(
      createPassage(ownerId, examId, {
        title: "P",
        contentJson: emptyDoc(),
        audioPolicy: "limited_replay",
      }),
    ).rejects.toBeInstanceOf(ExamError);
  });

  it("accepts limited_replay with maxAudioPlays", async () => {
    const { ownerId, courseId } = await newOwner("c4");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const { passageId } = await createPassage(ownerId, examId, {
      title: "P",
      contentJson: emptyDoc(),
      audioPolicy: "limited_replay",
      maxAudioPlays: 2,
    });
    const p = await prisma.examPassage.findUniqueOrThrow({ where: { id: passageId } });
    expect(p.audioPolicy).toBe("limited_replay");
    expect(p.maxAudioPlays).toBe(2);
  });

  it("refuses to create passage on a published exam", async () => {
    const { ownerId, courseId } = await newOwner("c5");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const skill = await prisma.skill.create({
      data: { code: "exam.passage.skill.c5", name: "S" },
    });
    const q = await prisma.examQuestion.create({
      data: {
        examId,
        type: "mcq",
        prompt: "Q",
        config: {
          options: [
            { id: "a", label: "A", isCorrect: true },
            { id: "b", label: "B", isCorrect: false },
          ],
        },
        points: 1,
        orderInExam: 0,
      },
    });
    await prisma.examQuestionSkillTag.create({
      data: { questionId: q.id, skillId: skill.id },
    });
    await publishExam(ownerId, examId);
    await expect(
      createPassage(ownerId, examId, { title: "P", contentJson: emptyDoc() }),
    ).rejects.toMatchObject({ code: "exam_not_draft" });
  });

  it("outsider cannot create passage", async () => {
    const { courseId } = await newOwner("c6");
    const owner = await prisma.user.findFirstOrThrow({
      where: { email: "po-c6@e.com" },
    });
    const { examId } = await createExam(owner.id, courseId, validExam());
    const other = await registerUser(
      { email: "outside-c6@e.com", password: "password1234", displayName: "X" },
      BASE,
    );
    await expect(
      createPassage(other.userId, examId, { title: "P", contentJson: emptyDoc() }),
    ).rejects.toBeInstanceOf(CourseAuthzError);
  });
});

describe("updatePassage", () => {
  it("updates title + clears maxAudioPlays when switching policy", async () => {
    const { ownerId, courseId } = await newOwner("u1");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const { passageId } = await createPassage(ownerId, examId, {
      title: "P",
      contentJson: emptyDoc(),
      audioPolicy: "limited_replay",
      maxAudioPlays: 3,
    });
    await updatePassage(ownerId, passageId, {
      title: "P2",
      audioPolicy: "free_replay",
    });
    const p = await prisma.examPassage.findUniqueOrThrow({ where: { id: passageId } });
    expect(p.title).toBe("P2");
    expect(p.audioPolicy).toBe("free_replay");
    expect(p.maxAudioPlays).toBeNull();
  });

  it("replaces skillTags when skillIds provided", async () => {
    const { ownerId, courseId } = await newOwner("u2");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const s1 = await prisma.skill.create({ data: { code: "u2.a", name: "A" } });
    const s2 = await prisma.skill.create({ data: { code: "u2.b", name: "B" } });
    const { passageId } = await createPassage(ownerId, examId, {
      title: "P",
      contentJson: emptyDoc(),
      skillIds: [s1.id],
    });
    await updatePassage(ownerId, passageId, { skillIds: [s2.id] });
    const tags = await prisma.examPassageSkillTag.findMany({ where: { passageId } });
    expect(tags.map((t) => t.skillId)).toEqual([s2.id]);
  });
});

describe("reorderPassages (A7.2.4)", () => {
  it("reorders within exam", async () => {
    const { ownerId, courseId } = await newOwner("r1");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const a = await createPassage(ownerId, examId, { title: "A", contentJson: emptyDoc() });
    const b = await createPassage(ownerId, examId, { title: "B", contentJson: emptyDoc() });
    const c = await createPassage(ownerId, examId, { title: "C", contentJson: emptyDoc() });
    await reorderPassages(ownerId, examId, [c.passageId, a.passageId, b.passageId]);
    const rows = await prisma.examPassage.findMany({
      where: { examId },
      orderBy: { orderIndex: "asc" },
    });
    expect(rows.map((r) => r.id)).toEqual([c.passageId, a.passageId, b.passageId]);
  });

  it("rejects when an id is missing", async () => {
    const { ownerId, courseId } = await newOwner("r2");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const a = await createPassage(ownerId, examId, { title: "A", contentJson: emptyDoc() });
    await createPassage(ownerId, examId, { title: "B", contentJson: emptyDoc() });
    await expect(
      reorderPassages(ownerId, examId, [a.passageId]),
    ).rejects.toMatchObject({ code: "must_include_all_passages" });
  });
});

describe("deletePassage", () => {
  it("hard-deletes passage on draft exam", async () => {
    const { ownerId, courseId } = await newOwner("d1");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const { passageId } = await createPassage(ownerId, examId, {
      title: "P",
      contentJson: emptyDoc(),
    });
    await deletePassage(ownerId, passageId);
    expect(await prisma.examPassage.findUnique({ where: { id: passageId } })).toBeNull();
  });
});

describe("createImageAsset (A7.2.2)", () => {
  it("creates image asset with alt text", async () => {
    const { ownerId, courseId } = await newOwner("a1");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const r = await createImageAsset(ownerId, examId, {
      s3Key: "exam-1.png",
      mimeType: "image/png",
      sizeBytes: 1234,
      altText: "A diagram",
      metadata: { width: 800, height: 600 },
    });
    const asset = await prisma.examAsset.findUniqueOrThrow({ where: { id: r.assetId } });
    expect(asset.type).toBe("image");
    expect(asset.altText).toBe("A diagram");
    expect(asset.uploadedById).toBe(ownerId);
  });

  it("rejects blank alt text", async () => {
    const { ownerId, courseId } = await newOwner("a2");
    const { examId } = await createExam(ownerId, courseId, validExam());
    await expect(
      createImageAsset(ownerId, examId, {
        s3Key: "x.png",
        mimeType: "image/png",
        sizeBytes: 100,
        altText: "",
      }),
    ).rejects.toMatchObject({ code: "alt_text_required" });
  });

  it("rejects unsupported mime type", async () => {
    const { ownerId, courseId } = await newOwner("a3");
    const { examId } = await createExam(ownerId, courseId, validExam());
    await expect(
      createImageAsset(ownerId, examId, {
        s3Key: "x.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
        altText: "x",
      }),
    ).rejects.toBeInstanceOf(ExamError);
  });

  it("rejects oversize image", async () => {
    const { ownerId, courseId } = await newOwner("a4");
    const { examId } = await createExam(ownerId, courseId, validExam());
    await expect(
      createImageAsset(ownerId, examId, {
        s3Key: "big.png",
        mimeType: "image/png",
        sizeBytes: 10 * 1024 * 1024,
        altText: "x",
      }),
    ).rejects.toBeInstanceOf(ExamError);
  });
});
