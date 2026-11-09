import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createExam, createOralMaterialDocument, createOralTopic } from "../../exam";
import { isLearnerActivityType } from "../../learning/activity";
import {
  addVanDapMaterial,
  buildQuestionMap,
  createVanDapExam,
  createVanDapItem,
  createVanDapScenario,
  deleteVanDapExam,
  deleteVanDapItem,
  getVanDapExamForEditor,
  getVanDapMaterialTexts,
  getVanDapPublicView,
  importVanDapFromLegacyExam,
  listLegacyOralImportCandidates,
  listVanDapExams,
  publishVanDapExam,
  removeVanDapMaterial,
  reorderVanDapItems,
  replaceVanDapPlan,
  resolveVanDapJoinCode,
  updateVanDapExam,
  updateVanDapItem,
  updateVanDapScenario,
  VAN_DAP_LIMITS,
  VanDapError,
} from "../index";
import { setLegacyOralDisabled } from "../../exam";

const BASE = "http://localhost:3000";

async function teacher(slug: string) {
  const u = await registerUser({ email: `vd-${slug}@e.com`, password: "password1234", displayName: slug }, BASE);
  return u.userId;
}

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ code });
}

const ITEM = { core: "Phân biệt vòng lặp for và while", expectedAnswer: "for biết trước số lần", sourceExcerpt: "Đoạn 3 của giáo trình" };

async function draftWithItems(owner: string, n = 2) {
  const { examId } = await createVanDapExam(owner, { title: "Đề thử" });
  await replaceVanDapPlan(owner, examId, Array.from({ length: n }, (_, i) => ({ ...ITEM, core: `Ý số ${i + 1}` })), { parts: 1 });
  return examId;
}

describe("Limio Vấn đáp — đề, quyền, khoá sau xuất bản", () => {
  it("tạo đề, liệt kê đề của mình; người khác không thấy và không sửa được (AC1.12)", async () => {
    const owner = await teacher("own");
    const other = await teacher("oth");
    const { examId } = await createVanDapExam(owner, { title: "Đề A", durationMin: 20 });
    expect((await listVanDapExams(owner)).map((e) => e.id)).toEqual([examId]);
    expect(await listVanDapExams(other)).toEqual([]);
    await expectCode(getVanDapExamForEditor(other, examId), "forbidden");
    await expectCode(updateVanDapExam(other, examId, { title: "x" }), "forbidden");
    await expectCode(createVanDapItem(other, examId, ITEM), "forbidden");
    await expectCode(getVanDapExamForEditor(owner, "00000000-0000-0000-0000-000000000000"), "not_found");
  });

  it("giảng viên đồng giảng của khoá sửa được đề gắn khoá (dùng chung kiểm quyền sửa đề)", async () => {
    const owner = await teacher("co-own");
    const course = await createCourse(owner, { title: "Khoá", description: "x", slug: "vd-co-course" });
    const { examId } = await createVanDapExam(owner, { title: "Đề trong khoá", courseId: course.courseId });
    const stranger = await teacher("co-str");
    await expectCode(createVanDapExam(stranger, { title: "Lén", courseId: course.courseId }), "forbidden");
    await expectCode(getVanDapExamForEditor(stranger, examId), "forbidden");
    await prisma.courseInstructor.create({ data: { courseId: course.courseId, userId: stranger, role: "co-instructor" } });
    expect((await getVanDapExamForEditor(stranger, examId)).exam.id).toBe(examId);
    expect((await listVanDapExams(stranger)).map((e) => e.id)).toContain(examId);
  });

  it("kiểm tra đầu vào: tên, thời lượng, ghi chú giọng điệu tối đa 500 ký tự", async () => {
    const owner = await teacher("val");
    await expectCode(createVanDapExam(owner, { title: "   " }), "validation_failed");
    await expectCode(createVanDapExam(owner, { title: "ok", durationMin: 1 }), "validation_failed");
    const { examId } = await createVanDapExam(owner, { title: "ok" });
    await expectCode(updateVanDapExam(owner, examId, { toneNote: "x".repeat(501) }), "validation_failed");
    await updateVanDapExam(owner, examId, { toneNote: "x".repeat(500) });
    expect((await prisma.vanDapExam.findUnique({ where: { id: examId } }))?.toneNote).toHaveLength(500);
    await updateVanDapExam(owner, examId, { toneNote: "" });
    expect((await prisma.vanDapExam.findUnique({ where: { id: examId } }))?.toneNote).toBeNull();
  });

  it("không xuất bản được khi dàn chưa có ý nào (AC1.9)", async () => {
    const owner = await teacher("pub0");
    const { examId } = await createVanDapExam(owner, { title: "Trống" });
    await expectCode(publishVanDapExam(owner, examId), "plan_empty");
    expect((await prisma.vanDapExam.findUnique({ where: { id: examId } }))?.status).toBe("draft");
  });

  it("sau khi xuất bản: tài liệu, dàn, kịch bản, tên bị khoá; rubric và giọng điệu vẫn sửa được (AC1.10)", async () => {
    const owner = await teacher("lock");
    const examId = await draftWithItems(owner);
    const { materialId } = await addVanDapMaterial(owner, examId, { title: "Giáo trình", extractedText: "Nội dung giáo trình." });
    const { scenarioId } = await createVanDapScenario(owner, examId, { title: "K1", aiContext: "Bối cảnh" });
    const items = (await getVanDapExamForEditor(owner, examId)).items;
    await publishVanDapExam(owner, examId);

    await expectCode(addVanDapMaterial(owner, examId, { title: "T", extractedText: "x" }), "exam_locked");
    await expectCode(removeVanDapMaterial(owner, examId, materialId), "exam_locked");
    await expectCode(createVanDapItem(owner, examId, ITEM), "exam_locked");
    await expectCode(updateVanDapItem(owner, examId, items[0]!.id, { core: "Đổi" }), "exam_locked");
    await expectCode(deleteVanDapItem(owner, examId, items[0]!.id), "exam_locked");
    await expectCode(reorderVanDapItems(owner, examId, items.map((i) => i.id).reverse()), "exam_locked");
    await expectCode(replaceVanDapPlan(owner, examId, [ITEM], { parts: 1 }), "exam_locked");
    await expectCode(createVanDapScenario(owner, examId, { title: "K2", aiContext: "x" }), "exam_locked");
    await expectCode(updateVanDapScenario(owner, examId, scenarioId, { title: "Đổi" }), "exam_locked");
    await expectCode(updateVanDapExam(owner, examId, { title: "Tên mới" }), "exam_locked");
    await expectCode(updateVanDapExam(owner, examId, { durationMin: 30 }), "exam_locked");
    await expectCode(deleteVanDapExam(owner, examId), "exam_locked");

    await updateVanDapExam(owner, examId, { toneNote: "Thân thiện", rubricText: "Chấm theo từng ý" });
    const row = await prisma.vanDapExam.findUnique({ where: { id: examId } });
    expect(row).toMatchObject({ status: "published", toneNote: "Thân thiện", rubricText: "Chấm theo từng ý" });
    await publishVanDapExam(owner, examId); // xuất bản lại là no-op
  });
});

describe("Limio Vấn đáp — tài liệu", () => {
  it("tệp không đọc được chữ bị từ chối ngay, không im lặng (AC1.2)", async () => {
    const owner = await teacher("mat0");
    const { examId } = await createVanDapExam(owner, { title: "T" });
    await expectCode(addVanDapMaterial(owner, examId, { title: "Scan", extractedText: null }), "material_unreadable");
    await expectCode(addVanDapMaterial(owner, examId, { title: "Scan", extractedText: "   " }), "material_unreadable");
    expect(await prisma.vanDapMaterial.count({ where: { examId } })).toBe(0);
  });

  it("thêm, đọc lại đầy đủ chữ, xoá và giữ thứ tự liền mạch; có trần số tệp và độ dài", async () => {
    const owner = await teacher("mat1");
    const { examId } = await createVanDapExam(owner, { title: "T" });
    const a = await addVanDapMaterial(owner, examId, { title: "A", extractedText: "aaa" });
    const b = await addVanDapMaterial(owner, examId, { title: "B", extractedText: "bbb" });
    await addVanDapMaterial(owner, examId, { title: "C", extractedText: "ccc" });
    await removeVanDapMaterial(owner, examId, a.materialId);
    const texts = await getVanDapMaterialTexts(owner, examId);
    expect(texts.map((t) => t.text)).toEqual(["bbb", "ccc"]);
    expect((await prisma.vanDapMaterial.findMany({ where: { examId }, orderBy: { orderIndex: "asc" } })).map((m) => m.orderIndex)).toEqual([0, 1]);
    expect((await getVanDapExamForEditor(owner, examId)).materials[0]).toMatchObject({ id: b.materialId, chars: 3 });

    await expectCode(
      addVanDapMaterial(owner, examId, { title: "Dài", extractedText: "x".repeat(VAN_DAP_LIMITS.materialMaxChars + 1) }),
      "text_too_long",
    );
    for (let i = 0; i < VAN_DAP_LIMITS.maxMaterials - 2; i++) {
      await addVanDapMaterial(owner, examId, { title: `M${i}`, extractedText: "x" });
    }
    await expectCode(addVanDapMaterial(owner, examId, { title: "Thừa", extractedText: "x" }), "too_many");
  });
});

describe("Limio Vấn đáp — dàn câu hỏi và kịch bản", () => {
  it("thay toàn bộ dàn, thêm, sửa, xoá, kéo đổi thứ tự (AC1.6)", async () => {
    const owner = await teacher("plan");
    const examId = await draftWithItems(owner, 3);
    let items = (await getVanDapExamForEditor(owner, examId)).items;
    expect(items.map((i) => i.core)).toEqual(["Ý số 1", "Ý số 2", "Ý số 3"]);
    expect(items.every((i) => i.maxFollowUps === VAN_DAP_LIMITS.defaultFollowUps)).toBe(true);

    await reorderVanDapItems(owner, examId, [items[2]!.id, items[0]!.id, items[1]!.id]);
    items = (await getVanDapExamForEditor(owner, examId)).items;
    expect(items.map((i) => i.core)).toEqual(["Ý số 3", "Ý số 1", "Ý số 2"]);
    expect(items.map((i) => i.orderIndex)).toEqual([0, 1, 2]);

    await expectCode(reorderVanDapItems(owner, examId, [items[0]!.id]), "not_a_permutation");
    await expectCode(reorderVanDapItems(owner, examId, [items[0]!.id, items[0]!.id, items[1]!.id]), "not_a_permutation");

    await updateVanDapItem(owner, examId, items[0]!.id, { core: "Ý đã sửa", level: "advanced", maxFollowUps: 0 });
    const { itemId } = await createVanDapItem(owner, examId, { core: "Ý thêm" });
    await deleteVanDapItem(owner, examId, items[1]!.id);
    const after = (await getVanDapExamForEditor(owner, examId)).items;
    expect(after.map((i) => i.core)).toEqual(["Ý đã sửa", "Ý số 2", "Ý thêm"]);
    expect(after.map((i) => i.orderIndex)).toEqual([0, 1, 2]);
    expect(after[0]).toMatchObject({ level: "advanced", maxFollowUps: 0 });
    expect(after[2]!.id).toBe(itemId);

    await expectCode(createVanDapItem(owner, examId, { core: "" }), "validation_failed");
    await expectCode(createVanDapItem(owner, examId, { core: "x", maxFollowUps: 9 }), "validation_failed");
  });

  it("thay dàn là tất cả hoặc không gì cả: dàn mới sai thì dàn cũ còn nguyên (AC1.5)", async () => {
    const owner = await teacher("atomic");
    const examId = await draftWithItems(owner, 2);
    await expectCode(replaceVanDapPlan(owner, examId, [ITEM, { core: "" }], { parts: 1 }), "validation_failed");
    await expectCode(replaceVanDapPlan(owner, examId, [], { parts: 1 }), "too_many");
    expect((await prisma.vanDapItem.count({ where: { examId } }))).toBe(2);
  });

  it("kịch bản: tối đa 30, dùng chung một dàn, sửa được (AC1.8)", async () => {
    const owner = await teacher("scn");
    const examId = await draftWithItems(owner, 1);
    for (let i = 0; i < VAN_DAP_LIMITS.maxScenarios; i++) {
      await createVanDapScenario(owner, examId, { title: `K${i}`, aiContext: `Bối cảnh ${i}`, studentBrief: i === 0 ? "Bạn là nhân viên mới" : "" });
    }
    await expectCode(createVanDapScenario(owner, examId, { title: "Thừa", aiContext: "x" }), "too_many");
    const detail = await getVanDapExamForEditor(owner, examId);
    expect(detail.scenarios).toHaveLength(30);
    expect(detail.scenarios[0]!.studentBrief).toBe("Bạn là nhân viên mới");
    expect(detail.scenarios[1]!.studentBrief).toBeNull();
    await updateVanDapScenario(owner, examId, detail.scenarios[0]!.id, { title: "Đổi tên" });
    expect((await prisma.vanDapScenario.findUnique({ where: { id: detail.scenarios[0]!.id } }))?.title).toBe("Đổi tên");
    // Dàn không phụ thuộc kịch bản: vẫn đúng 1 ý.
    expect(detail.items).toHaveLength(1);
  });
});

describe("Limio Vấn đáp — bản đồ câu hỏi (AC1.7)", () => {
  const items = (n: number, f = 2) => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, core: `Ý ${i}`, level: "basic", maxFollowUps: f }));

  it("đủ thời gian: mọi ý được hỏi, kèm câu đào sâu theo thứ tự ưu tiên", () => {
    const m = buildQuestionMap({ items: items(3), scenarios: [{ id: "s", title: "K" }], durationMin: 30 });
    expect(m.capacity).toBe(20);
    expect(m.coveredCount).toBe(3);
    expect(m.rows.map((r) => r.estimatedQuestions)).toEqual([3, 3, 3]);
    expect(m.scenarios).toHaveLength(1);
  });

  it("thiếu thời gian: ý đứng sau không kịp, ý đứng trước được ưu tiên", () => {
    const m = buildQuestionMap({ items: items(10), scenarios: [], durationMin: 9 });
    expect(m.capacity).toBe(6);
    expect(m.rows.filter((r) => r.covered).map((r) => r.position)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(m.uncoveredCount).toBe(4);
    expect(m.totalEstimatedQuestions).toBe(6);
  });

  it("quỹ thừa chia cho câu đào sâu của các ý đầu trước", () => {
    const m = buildQuestionMap({ items: items(4, 2), scenarios: [], durationMin: 9 });
    expect(m.capacity).toBe(6);
    // 4 ý chiếm 4 câu chính; 2 câu còn lại dồn cho đào sâu ý đầu tiên.
    expect(m.rows.map((r) => r.estimatedQuestions)).toEqual([3, 1, 1, 1]);
    expect(m.totalEstimatedQuestions).toBe(6);
  });
});

describe("Limio Vấn đáp — nhập từ đề vấn đáp cũ (AC0.4, AC0.5)", () => {
  async function legacyExam(owner: string) {
    const course = await createCourse(owner, { title: "Khoá cũ", description: "x", slug: `vd-legacy-${owner.slice(0, 6)}` });
    const now = Date.now();
    const { examId } = await createExam(owner, course.courseId, {
      title: "Vấn đáp cũ",
      durationMin: 25,
      openAt: new Date(now - 60_000),
      closeAt: new Date(now + 86_400_000),
      kind: "oral",
    });
    await prisma.exam.update({
      where: { id: examId },
      data: { examinerInstructions: "Hỏi hết chủ đề này mới sang chủ đề khác. Không để SV dẫn dắt.", oralRubricText: "Rubric nhập tay" },
    });
    await createOralMaterialDocument(owner, examId, {
      type: "document", title: "Giáo trình", s3Key: "a.pdf", mimeType: "application/pdf", sizeBytes: 100, extractedText: "Nội dung giáo trình.",
    });
    // Bản scan (không có chữ) và rubric dạng tệp là dữ liệu cũ: tạo thẳng vì bản cũ không còn nhận rubric tệp mới.
    await prisma.oralExamMaterial.createMany({
      data: [
        { examId, type: "document", title: "Bản scan", s3Key: "b.pdf", mimeType: "application/pdf", sizeBytes: 100, extractedText: null, orderIndex: 1, uploadedById: owner },
        { examId, type: "rubric", title: "Rubric tệp", s3Key: "c.pdf", mimeType: "application/pdf", sizeBytes: 100, extractedText: "Tiêu chí từ tệp", orderIndex: 2, uploadedById: owner },
      ],
    });
    await createOralTopic(owner, examId, { title: "Chủ đề 1", brief: "Dữ kiện chỉ AI biết", studentBrief: "Bạn là kế toán" });
    await createOralTopic(owner, examId, { title: "Chủ đề 2", brief: "Bối cảnh 2" });
    return examId;
  }

  it("tạo đề MỚI ở dạng nháp với tài liệu, kịch bản, rubric; đề cũ không đổi; prompt cũ chỉ để đối chiếu", async () => {
    const owner = await teacher("imp");
    const legacyId = await legacyExam(owner);
    const before = JSON.stringify(await prisma.exam.findUnique({ where: { id: legacyId }, include: { oralMaterials: true, oralTopics: true } }));

    const r = await importVanDapFromLegacyExam(owner, legacyId);
    expect(r).toMatchObject({ materials: 1, scenarios: 2, skippedMaterials: 1 });

    const d = await getVanDapExamForEditor(owner, r.examId);
    expect(d.exam).toMatchObject({ status: "draft", durationMin: 25, importedFromExamId: legacyId });
    expect(d.exam.title).toContain("Limio Vấn đáp");
    expect(d.materials.map((m) => m.title)).toEqual(["Giáo trình"]);
    expect(d.scenarios.map((s) => [s.title, s.aiContext, s.studentBrief])).toEqual([
      ["Chủ đề 1", "Dữ kiện chỉ AI biết", "Bạn là kế toán"],
      ["Chủ đề 2", "Bối cảnh 2", null],
    ]);
    expect(d.exam.rubricText).toBe("Rubric nhập tay\n\nTiêu chí từ tệp");
    // AC0.5: prompt cũ chỉ ở khung chỉ đọc, KHÔNG chép sang ghi chú giọng điệu.
    expect(d.exam.legacyPrompt).toContain("Không để SV dẫn dắt");
    expect(d.exam.toneNote).toBeNull();
    expect(d.items).toEqual([]);

    expect(JSON.stringify(await prisma.exam.findUnique({ where: { id: legacyId }, include: { oralMaterials: true, oralTopics: true } }))).toBe(before);
  });

  it("vẫn nhập được sau khi bản cũ đã tắt; người không sửa được đề cũ thì bị từ chối; không phải đề vấn đáp thì từ chối", async () => {
    const owner = await teacher("imp2");
    const legacyId = await legacyExam(owner);
    const admin = await prisma.user.create({ data: { email: "vd-adm@e.com", displayName: "A", passwordHash: "x" } });
    const role = await prisma.role.upsert({ where: { name: "admin" }, update: {}, create: { name: "admin" } });
    await prisma.userRole.create({ data: { userId: admin.id, roleId: role.id } });
    await setLegacyOralDisabled(admin.id, true);

    const stranger = await teacher("imp2s");
    await expectCode(importVanDapFromLegacyExam(stranger, legacyId), "forbidden");
    await expect(importVanDapFromLegacyExam(owner, legacyId)).resolves.toMatchObject({ scenarios: 2 });

    const course2 = await createCourse(owner, { title: "Khoá thi viết", description: "x", slug: "vd-written-course" });
    const now = Date.now();
    const written = await createExam(owner, course2.courseId, {
      title: "Viết",
      durationMin: 10,
      openAt: new Date(now - 60_000),
      closeAt: new Date(now + 86_400_000),
      kind: "written",
    });
    await expectCode(importVanDapFromLegacyExam(owner, written.examId), "legacy_not_oral");

    const list = await listLegacyOralImportCandidates(owner);
    expect(list).toEqual([expect.objectContaining({ id: legacyId, materials: 3, topics: 2, hasPrompt: true, alreadyImported: true })]);
  });
});

describe("Limio Vấn đáp — sự kiện, phần học viên thấy, mã tham gia", () => {
  it("mọi hành động của giảng viên ghi sự kiện vandap.* chỉ mang id và số liệu, không mang nội dung (AC0.7)", async () => {
    const owner = await teacher("evt");
    const SECRET_TEXT = "BÍ-MẬT-TÀI-LIỆU";
    const SECRET_Q = "CÂU-HỎI-RIÊNG";
    const SECRET_A = "ĐÁP-ÁN-RIÊNG";
    const { examId } = await createVanDapExam(owner, { title: "Tiêu đề kín" });
    await addVanDapMaterial(owner, examId, { title: "Tên tệp", extractedText: SECRET_TEXT });
    await replaceVanDapPlan(owner, examId, [{ core: SECRET_Q, expectedAnswer: SECRET_A }], { parts: 2 });
    await createVanDapScenario(owner, examId, { title: "K", aiContext: "ngữ cảnh kín" });
    await updateVanDapExam(owner, examId, { toneNote: "giọng kín" });
    await publishVanDapExam(owner, examId);

    const events = await prisma.learningEvent.findMany({ where: { userId: owner, eventType: { startsWith: "vandap." } } });
    const types = new Set(events.map((e) => e.eventType));
    for (const t of [
      LearningEventType.VanDapExamCreated,
      LearningEventType.VanDapMaterialAdded,
      LearningEventType.VanDapPlanGenerated,
      LearningEventType.VanDapScenarioEdited,
      LearningEventType.VanDapExamUpdated,
      LearningEventType.VanDapExamPublished,
    ]) {
      expect(types.has(t), `thiếu ${t}`).toBe(true);
    }
    const blob = JSON.stringify(events.map((e) => e.payload));
    for (const secret of [SECRET_TEXT, SECRET_Q, SECRET_A, "ngữ cảnh kín", "giọng kín", "Tiêu đề kín", "Tên tệp"]) {
      expect(blob.includes(secret), `payload không được mang: ${secret}`).toBe(false);
    }
    expect(events.find((e) => e.eventType === LearningEventType.VanDapPlanGenerated)?.payload).toEqual({ examId, items: 1, parts: 2 });
    // Hành động của giảng viên không tính là hoạt động học.
    expect(events.every((e) => !isLearnerActivityType(e.eventType))).toBe(true);
  });

  it("phần học viên thấy không bao giờ có đáp án mong đợi, đoạn nguồn, ý cần hỏi hay bối cảnh của AI (AC1.11)", async () => {
    const owner = await teacher("pubv");
    const { examId } = await createVanDapExam(owner, { title: "Đề công khai" });
    await replaceVanDapPlan(
      owner,
      examId,
      [{ core: "Ý-CẦN-HỎI-KÍN", expectedAnswer: "ĐÁP-ÁN-KÍN", sourceExcerpt: "ĐOẠN-NGUỒN-KÍN" }],
      { parts: 1 },
    );
    await createVanDapScenario(owner, examId, { title: "Kịch bản A", aiContext: "BỐI-CẢNH-AI-KÍN", studentBrief: "Bạn là học viên" });
    expect(await getVanDapPublicView(examId)).toBeNull(); // chưa xuất bản thì không lộ gì
    await publishVanDapExam(owner, examId);

    const view = await getVanDapPublicView(examId);
    expect(view).toMatchObject({ title: "Đề công khai", scenarios: [{ title: "Kịch bản A", studentBrief: "Bạn là học viên" }] });
    const blob = JSON.stringify(view);
    for (const secret of ["Ý-CẦN-HỎI-KÍN", "ĐÁP-ÁN-KÍN", "ĐOẠN-NGUỒN-KÍN", "BỐI-CẢNH-AI-KÍN", "expectedAnswer", "sourceExcerpt", "aiContext", "items"]) {
      expect(blob.includes(secret), `học viên không được thấy: ${secret}`).toBe(false);
    }

    // Cùng điều đó qua mã tham gia.
    await prisma.vanDapSession.create({ data: { examId, joinCode: "ABC234", openedById: owner } });
    const join = await resolveVanDapJoinCode("ABC234");
    expect(join?.isOpen).toBe(true);
    for (const secret of ["Ý-CẦN-HỎI-KÍN", "ĐÁP-ÁN-KÍN", "ĐOẠN-NGUỒN-KÍN", "BỐI-CẢNH-AI-KÍN"]) {
      expect(JSON.stringify(join).includes(secret)).toBe(false);
    }
    expect(await resolveVanDapJoinCode("ZZZZZZ")).toBeNull();
    await prisma.vanDapSession.update({ where: { joinCode: "ABC234" }, data: { status: "closed" } });
    expect((await resolveVanDapJoinCode("ABC234"))?.isOpen).toBe(false);
  });

  it("mã tham gia của buổi chưa xuất bản đề thì không tra ra", async () => {
    const owner = await teacher("pubd");
    const { examId } = await createVanDapExam(owner, { title: "Nháp" });
    await prisma.vanDapSession.create({ data: { examId, joinCode: "DRF234", openedById: owner } });
    expect(await resolveVanDapJoinCode("DRF234")).toBeNull();
  });
});
