import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { GLOBAL_TOKENS_PER_DAY_KEY } from "../aiTutor/aiTutor";
import { AiTutorError } from "../aiTutor/errors";
import { embedMaterial, searchMaterialChunks } from "../oralExam/materialEmbeddings";
import type { EmbedComputeFn } from "../oralExam/embeddings";

const DIM = 1536;

/** Vector giả 1536 chiều: 2 giá trị đầu mang "tín hiệu", còn lại 0. */
function fakeVector(x: number, y: number): number[] {
  const v = new Array(DIM).fill(0);
  v[0] = x;
  v[1] = y;
  return v;
}

async function makeOwner(slug: string) {
  return prisma.user.create({
    data: { email: `me-${slug}@e.com`, passwordHash: "x", displayName: slug },
  });
}

async function makeCourse(slug: string) {
  return prisma.course.create({
    data: { slug: `me-course-${slug}`, title: `Course ${slug}`, description: "x" },
  });
}

async function makeOralExam(courseId: string, slug: string) {
  const now = Date.now();
  return prisma.exam.create({
    data: {
      courseId,
      title: `Vấn đáp ${slug}`,
      durationMin: 20,
      openAt: new Date(now),
      closeAt: new Date(now + 7 * 24 * 3600_000),
      kind: "oral",
    },
  });
}

async function makeMaterial(
  examId: string,
  uploadedById: string,
  extractedText: string | null,
  slug: string,
) {
  return prisma.oralExamMaterial.create({
    data: {
      examId,
      type: "topic_list",
      title: `Tài liệu ${slug}`,
      extractedText,
      orderIndex: 0,
      uploadedById,
    },
  });
}

async function setGlobalCap(value: string | null) {
  if (value === null) {
    await prisma.siteSetting.deleteMany({ where: { key: GLOBAL_TOKENS_PER_DAY_KEY } });
    return;
  }
  await prisma.siteSetting.upsert({
    where: { key: GLOBAL_TOKENS_PER_DAY_KEY },
    create: { key: GLOBAL_TOKENS_PER_DAY_KEY, value },
    update: { value },
  });
}

afterEach(async () => {
  await setGlobalCap(null);
});

function constantEmbed(vector: number[], tokensUsed = 42): EmbedComputeFn {
  return async (texts: string[]) => ({
    embeddings: texts.map(() => vector),
    tokensUsed,
  });
}

describe("embedMaterial (A6.2)", () => {
  it("chunks, embeds, and stores chunks; returns skipped=false", async () => {
    const owner = await makeOwner("e1");
    const course = await makeCourse("e1");
    const exam = await makeOralExam(course.id, "e1");
    const material = await makeMaterial(exam.id, owner.id, "Nội dung ôn tập chương 1.", "e1");

    const r = await embedMaterial(owner.id, material.id, constantEmbed(fakeVector(1, 0)));
    expect(r).toEqual({ chunkCount: 1, skipped: false });

    const chunks = await prisma.oralExamMaterialChunk.findMany({ where: { materialId: material.id } });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.chunkText).toBe("Nội dung ôn tập chương 1.");
    expect(chunks[0]!.chunkIndex).toBe(0);
  });

  it("skips (no error, no chunks) when extractedText is null", async () => {
    const owner = await makeOwner("e2");
    const course = await makeCourse("e2");
    const exam = await makeOralExam(course.id, "e2");
    const material = await makeMaterial(exam.id, owner.id, null, "e2");

    let computeCalled = false;
    const compute: EmbedComputeFn = async (texts) => {
      computeCalled = true;
      return { embeddings: texts.map(() => fakeVector(1, 0)), tokensUsed: 1 };
    };

    const r = await embedMaterial(owner.id, material.id, compute);
    expect(r).toEqual({ chunkCount: 0, skipped: true });
    expect(computeCalled).toBe(false);
  });

  it("re-embedding replaces old chunks instead of appending", async () => {
    const owner = await makeOwner("e3");
    const course = await makeCourse("e3");
    const exam = await makeOralExam(course.id, "e3");
    const material = await makeMaterial(exam.id, owner.id, "Đoạn A.\n\nĐoạn B.", "e3");

    await embedMaterial(owner.id, material.id, constantEmbed(fakeVector(1, 0)));
    const firstCount = await prisma.oralExamMaterialChunk.count({ where: { materialId: material.id } });
    expect(firstCount).toBe(1);

    await embedMaterial(owner.id, material.id, constantEmbed(fakeVector(0, 1)));
    const secondCount = await prisma.oralExamMaterialChunk.count({ where: { materialId: material.id } });
    expect(secondCount).toBe(1);
  });

  it("throws material_not_found for an unknown materialId", async () => {
    const owner = await makeOwner("e4");
    await expect(
      embedMaterial(owner.id, "00000000-0000-0000-0000-000000000000", constantEmbed(fakeVector(1, 0))),
    ).rejects.toMatchObject({ code: "material_not_found" });
  });

  it("respects the global token cap — throws before calling compute, no chunks written", async () => {
    const owner = await makeOwner("e5");
    const course = await makeCourse("e5");
    const exam = await makeOralExam(course.id, "e5");
    const material = await makeMaterial(exam.id, owner.id, "Nội dung.", "e5");
    await setGlobalCap("0");

    let computeCalled = false;
    const compute: EmbedComputeFn = async (texts) => {
      computeCalled = true;
      return { embeddings: texts.map(() => fakeVector(1, 0)), tokensUsed: 1 };
    };

    await expect(embedMaterial(owner.id, material.id, compute)).rejects.toBeInstanceOf(AiTutorError);
    expect(computeCalled).toBe(false);
    const count = await prisma.oralExamMaterialChunk.count({ where: { materialId: material.id } });
    expect(count).toBe(0);
  });

  it("leaves 0 chunks (not a mix of old/new) when compute() fails", async () => {
    const owner = await makeOwner("e6");
    const course = await makeCourse("e6");
    const exam = await makeOralExam(course.id, "e6");
    const material = await makeMaterial(exam.id, owner.id, "Đoạn A.\n\nĐoạn B.", "e6");

    await embedMaterial(owner.id, material.id, constantEmbed(fakeVector(1, 0)));
    expect(await prisma.oralExamMaterialChunk.count({ where: { materialId: material.id } })).toBe(1);

    const failing: EmbedComputeFn = async () => {
      throw new Error("openai down");
    };
    await expect(embedMaterial(owner.id, material.id, failing)).rejects.toMatchObject({
      code: "openai_error",
    });
    expect(await prisma.oralExamMaterialChunk.count({ where: { materialId: material.id } })).toBe(0);
  });

  it("records AiUsageLog with the embedding model and emits exam.oral_material.embedded", async () => {
    const owner = await makeOwner("e7");
    const course = await makeCourse("e7");
    const exam = await makeOralExam(course.id, "e7");
    const material = await makeMaterial(exam.id, owner.id, "Nội dung.", "e7");

    await embedMaterial(owner.id, material.id, constantEmbed(fakeVector(1, 0), 77));

    const usage = await prisma.aiUsageLog.findFirst({
      where: { userId: owner.id, model: "text-embedding-3-small" },
    });
    expect(usage?.tokensInput).toBe(77);

    const ev = await prisma.learningEvent.findFirst({
      where: { eventType: LearningEventType.ExamOralMaterialEmbedded, userId: owner.id },
    });
    expect(ev).not.toBeNull();
    expect((ev!.payload as Record<string, unknown>).materialId).toBe(material.id);
    expect((ev!.payload as Record<string, unknown>).chunkCount).toBe(1);
  });
});

describe("searchMaterialChunks (A6.2)", () => {
  it("ranks the chunk closest to the query vector first", async () => {
    const owner = await makeOwner("s1");
    const course = await makeCourse("s1");
    const exam = await makeOralExam(course.id, "s1");
    const matA = await makeMaterial(exam.id, owner.id, "Về vòng lặp.", "s1a");
    const matB = await makeMaterial(exam.id, owner.id, "Về đệ quy.", "s1b");
    await embedMaterial(owner.id, matA.id, constantEmbed(fakeVector(1, 0)));
    await embedMaterial(owner.id, matB.id, constantEmbed(fakeVector(0, 1)));

    const results = await searchMaterialChunks(exam.id, fakeVector(1, 0.01), 2);
    expect(results).toHaveLength(2);
    expect(results[0]!.materialId).toBe(matA.id);
    expect(results[1]!.materialId).toBe(matB.id);
  });

  it("never returns chunks from a different exam", async () => {
    const owner = await makeOwner("s2");
    const courseA = await makeCourse("s2a");
    const courseB = await makeCourse("s2b");
    const examA = await makeOralExam(courseA.id, "s2a");
    const examB = await makeOralExam(courseB.id, "s2b");
    const matA = await makeMaterial(examA.id, owner.id, "Nội dung A.", "s2a");
    const matB = await makeMaterial(examB.id, owner.id, "Nội dung B.", "s2b");
    await embedMaterial(owner.id, matA.id, constantEmbed(fakeVector(1, 0)));
    await embedMaterial(owner.id, matB.id, constantEmbed(fakeVector(1, 0)));

    const results = await searchMaterialChunks(examA.id, fakeVector(1, 0), 10);
    expect(results.every((r) => r.materialId === matA.id)).toBe(true);
  });

  it("respects the k limit", async () => {
    const owner = await makeOwner("s3");
    const course = await makeCourse("s3");
    const exam = await makeOralExam(course.id, "s3");
    const matA = await makeMaterial(exam.id, owner.id, "Đoạn 1.", "s3a");
    const matB = await makeMaterial(exam.id, owner.id, "Đoạn 2.", "s3b");
    await embedMaterial(owner.id, matA.id, constantEmbed(fakeVector(1, 0)));
    await embedMaterial(owner.id, matB.id, constantEmbed(fakeVector(1, 0)));

    // 2 chunk tổng cộng — k=1 phải trả đúng 1, không phải cả 2.
    const results = await searchMaterialChunks(exam.id, fakeVector(1, 0), 1);
    expect(results).toHaveLength(1);
  });
});
