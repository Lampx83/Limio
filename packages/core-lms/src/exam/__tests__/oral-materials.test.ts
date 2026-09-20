import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { CourseAuthzError } from "../../courses/authz";
import {
  createExam,
  createExamQuestion,
  createOralMaterialDocument,
  createOralMaterialTopicList,
  deleteOralMaterial,
  ExamError,
  listOralMaterials,
  publishExam,
  reorderOralMaterials,
  upsertBlueprint,
} from "../";

const BASE = "http://localhost:3000";

async function newOwner(slug: string) {
  const u = await registerUser(
    { email: `om-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const c = await createCourse(u.userId, {
    title: `Oral exam course ${slug}`,
    description: "x",
    slug: `oral-exam-course-${slug}`,
  });
  return { ownerId: u.userId, courseId: c.courseId };
}

async function newOutsider(slug: string) {
  const u = await registerUser(
    { email: `omu-${slug}@e.com`, password: "password1234", displayName: "U" },
    BASE,
  );
  return u.userId;
}

function baseExamInput(overrides: Partial<Record<string, unknown>> = {}) {
  const now = Date.now();
  return {
    title: "Vấn đáp cuối kỳ",
    durationMin: 20,
    openAt: new Date(now + 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
    ...overrides,
  };
}

async function newOralExam(slug: string) {
  const { ownerId, courseId } = await newOwner(slug);
  const { examId } = await createExam(ownerId, courseId, baseExamInput({ kind: "oral" }));
  return { ownerId, courseId, examId };
}

describe("createExam kind (A6.1)", () => {
  it("defaults to written when kind is omitted", async () => {
    const { ownerId, courseId } = await newOwner("kw1");
    const { examId } = await createExam(ownerId, courseId, baseExamInput());
    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: examId } });
    expect(exam.kind).toBe("written");
  });

  it("creates an oral exam when kind=oral", async () => {
    const { examId } = await newOralExam("kw2");
    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: examId } });
    expect(exam.kind).toBe("oral");
  });
});

describe("createOralMaterialDocument (A6.1)", () => {
  it("registers a document material with extracted text, orderIndex=0", async () => {
    const { ownerId, examId } = await newOralExam("d1");
    const r = await createOralMaterialDocument(ownerId, examId, {
      type: "document",
      title: "Đề cương chương 1",
      s3Key: "d1.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractedText: "Nội dung chương 1",
    });
    expect(r.extracted).toBe(true);
    const material = await prisma.oralExamMaterial.findUniqueOrThrow({
      where: { id: r.materialId },
    });
    expect(material.type).toBe("document");
    expect(material.orderIndex).toBe(0);
    expect(material.extractedText).toBe("Nội dung chương 1");
  });

  it("rejects type=rubric — rubric is now Exam.oralRubricText, not an uploaded material", async () => {
    const { ownerId, examId } = await newOralExam("d1b");
    await expect(
      createOralMaterialDocument(ownerId, examId, {
        type: "rubric",
        title: "Rubric",
        s3Key: "r.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
        extractedText: "x",
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("second material appended at orderIndex=1", async () => {
    const { ownerId, examId } = await newOralExam("d2");
    await createOralMaterialDocument(ownerId, examId, {
      type: "document",
      title: "A",
      s3Key: "a.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      extractedText: "a",
    });
    const r2 = await createOralMaterialDocument(ownerId, examId, {
      type: "document",
      title: "B",
      s3Key: "b.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      extractedText: "b",
    });
    const m2 = await prisma.oralExamMaterial.findUniqueOrThrow({ where: { id: r2.materialId } });
    expect(m2.orderIndex).toBe(1);
  });

  it("accepts extractedText=null when parse failed — does not block upload", async () => {
    const { ownerId, examId } = await newOralExam("d3");
    const r = await createOralMaterialDocument(ownerId, examId, {
      type: "document",
      title: "Scan không có text layer",
      s3Key: "scan.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      extractedText: null,
    });
    expect(r.extracted).toBe(false);
    const material = await prisma.oralExamMaterial.findUniqueOrThrow({
      where: { id: r.materialId },
    });
    expect(material.extractedText).toBeNull();
  });

  it("rejects on a written exam with exam_not_oral", async () => {
    const { ownerId, courseId } = await newOwner("d4");
    const { examId } = await createExam(ownerId, courseId, baseExamInput());
    await expect(
      createOralMaterialDocument(ownerId, examId, {
        type: "document",
        title: "X",
        s3Key: "x.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
        extractedText: "x",
      }),
    ).rejects.toMatchObject({ code: "exam_not_oral" });
  });

  it("rejects once the exam is published (exam_not_draft)", async () => {
    const { ownerId, examId } = await newOralExam("d5");
    await createOralMaterialTopicList(ownerId, examId, { title: "seed", text: "seed" });
    await publishExam(ownerId, examId);
    await expect(
      createOralMaterialDocument(ownerId, examId, {
        type: "document",
        title: "X",
        s3Key: "x.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
        extractedText: "x",
      }),
    ).rejects.toMatchObject({ code: "exam_not_draft" });
  });

  it("rejects an outsider with CourseAuthzError forbidden", async () => {
    const { examId } = await newOralExam("d6");
    const outsider = await newOutsider("d6");
    await expect(
      createOralMaterialDocument(outsider, examId, {
        type: "document",
        title: "X",
        s3Key: "x.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
        extractedText: "x",
      }),
    ).rejects.toBeInstanceOf(CourseAuthzError);
  });

  it("emits exam.oral_material.uploaded", async () => {
    const { ownerId, examId } = await newOralExam("d7");
    const r = await createOralMaterialDocument(ownerId, examId, {
      type: "document",
      title: "X",
      s3Key: "x.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      extractedText: "x",
    });
    const ev = await prisma.learningEvent.findFirst({
      where: { eventType: LearningEventType.ExamOralMaterialUploaded, userId: ownerId },
    });
    expect(ev).not.toBeNull();
    expect((ev!.payload as Record<string, unknown>).materialId).toBe(r.materialId);
  });
});

describe("createOralMaterialTopicList (A6.1)", () => {
  it("registers a topic_list material with no s3Key", async () => {
    const { ownerId, examId } = await newOralExam("t1");
    const r = await createOralMaterialTopicList(ownerId, examId, {
      title: "Chủ đề ôn tập",
      text: "1. Vòng lặp\n2. Đệ quy",
    });
    const material = await prisma.oralExamMaterial.findUniqueOrThrow({
      where: { id: r.materialId },
    });
    expect(material.type).toBe("topic_list");
    expect(material.s3Key).toBeNull();
    expect(material.extractedText).toBe("1. Vòng lặp\n2. Đệ quy");
  });
});

describe("listOralMaterials (A6.1)", () => {
  it("returns materials ordered by orderIndex", async () => {
    const { ownerId, examId } = await newOralExam("l1");
    await createOralMaterialTopicList(ownerId, examId, { title: "A", text: "a" });
    await createOralMaterialTopicList(ownerId, examId, { title: "B", text: "b" });
    const list = await listOralMaterials(ownerId, examId);
    expect(list.map((m) => m.title)).toEqual(["A", "B"]);
  });

  it("reports chunkCount so the UI can tell embedded from not-embedded materials", async () => {
    const { ownerId, examId } = await newOralExam("l3");
    const a = await createOralMaterialTopicList(ownerId, examId, { title: "A", text: "a" });
    const b = await createOralMaterialTopicList(ownerId, examId, { title: "B", text: "b" });
    // Chỉ cần dòng chunk tồn tại — embedding nullable, không gọi OpenAI trong test.
    await prisma.oralExamMaterialChunk.createMany({
      data: [
        { materialId: b.materialId, chunkIndex: 0, chunkText: "b0" },
        { materialId: b.materialId, chunkIndex: 1, chunkText: "b1" },
      ],
    });
    const list = await listOralMaterials(ownerId, examId);
    expect(list.find((m) => m.id === a.materialId)!.chunkCount).toBe(0);
    expect(list.find((m) => m.id === b.materialId)!.chunkCount).toBe(2);
  });

  it("rejects listing on a written exam with exam_not_oral", async () => {
    const { ownerId, courseId } = await newOwner("l2");
    const { examId } = await createExam(ownerId, courseId, baseExamInput());
    await expect(listOralMaterials(ownerId, examId)).rejects.toMatchObject({
      code: "exam_not_oral",
    });
  });
});

describe("reorderOralMaterials (A6.1)", () => {
  it("applies the new order", async () => {
    const { ownerId, examId } = await newOralExam("r1");
    const a = await createOralMaterialTopicList(ownerId, examId, { title: "A", text: "a" });
    const b = await createOralMaterialTopicList(ownerId, examId, { title: "B", text: "b" });
    await reorderOralMaterials(ownerId, examId, [b.materialId, a.materialId]);
    const list = await listOralMaterials(ownerId, examId);
    expect(list.map((m) => m.id)).toEqual([b.materialId, a.materialId]);
  });

  it("rejects a partial/mismatched id set", async () => {
    const { ownerId, examId } = await newOralExam("r2");
    const a = await createOralMaterialTopicList(ownerId, examId, { title: "A", text: "a" });
    await createOralMaterialTopicList(ownerId, examId, { title: "B", text: "b" });
    await expect(
      reorderOralMaterials(ownerId, examId, [a.materialId]),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });
});

describe("deleteOralMaterial (A6.1)", () => {
  it("removes the record and emits exam.oral_material.deleted", async () => {
    const { ownerId, examId } = await newOralExam("x1");
    const r = await createOralMaterialTopicList(ownerId, examId, { title: "A", text: "a" });
    const deleted = await deleteOralMaterial(ownerId, r.materialId);
    expect(deleted.id).toBe(r.materialId);
    await expect(
      prisma.oralExamMaterial.findUniqueOrThrow({ where: { id: r.materialId } }),
    ).rejects.toThrow();
    const ev = await prisma.learningEvent.findFirst({
      where: { eventType: LearningEventType.ExamOralMaterialDeleted, userId: ownerId },
    });
    expect(ev).not.toBeNull();
  });

  it("rejects an unknown materialId with material_not_found", async () => {
    const { ownerId } = await newOralExam("x2");
    await expect(
      deleteOralMaterial(ownerId, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toMatchObject({ code: "material_not_found" });
  });
});

describe("publishExam for oral exams (A6.1)", () => {
  it("rejects publish when there is no material", async () => {
    const { ownerId, examId } = await newOralExam("p1");
    await expect(publishExam(ownerId, examId)).rejects.toMatchObject({
      code: "exam_not_publishable",
    });
  });

  it("publishes once at least 1 material exists", async () => {
    const { ownerId, examId } = await newOralExam("p2");
    await createOralMaterialTopicList(ownerId, examId, { title: "seed", text: "seed" });
    await publishExam(ownerId, examId);
    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: examId } });
    expect(exam.status).toBe("published");
  });
});

describe("written-only mutations reject oral exams (A6.1)", () => {
  it("createExamQuestion throws exam_not_written on an oral exam", async () => {
    const { ownerId, examId } = await newOralExam("w1");
    await expect(createExamQuestion(ownerId, examId, {})).rejects.toMatchObject({
      code: "exam_not_written",
    });
  });

  it("upsertBlueprint throws exam_not_written on an oral exam", async () => {
    const { ownerId, examId } = await newOralExam("w2");
    await expect(upsertBlueprint(ownerId, examId, {})).rejects.toMatchObject({
      code: "exam_not_written",
    });
  });
});

describe("ExamError instance check", () => {
  it("guards above throw ExamError, not a generic Error", async () => {
    const { ownerId, courseId } = await newOwner("e1");
    const { examId } = await createExam(ownerId, courseId, baseExamInput());
    try {
      await createOralMaterialTopicList(ownerId, examId, { title: "A", text: "a" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ExamError);
    }
  });
});
