import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import type { LessonOutline, SourcePara } from "@feedbackme/shared-types";
import { createCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import type { LessonDraftResult } from "@feedbackme/shared-types";
import {
  LessonDraftError,
  applyLessonDraft,
  createLessonDraft,
  discardLessonDraft,
  getActiveLessonDraftId,
  getLessonDraft,
  saveLessonDraftResult,
  updateLessonDraft,
} from "../lessonDrafts";
import { registerUser } from "../../auth/register";

/** Mốc 2 — bản nháp "tạo bài từ tài liệu" (D3, D6, D7). */

const BASE = "http://localhost:3000";

const PARAS: SourcePara[] = [{ t: "Đoạn một." }, { img: "/api/lesson-media/images/a.png", alt: "Hình A" }, { t: "Đoạn ba." }];
const OUTLINE: LessonOutline = {
  ignoredParas: [],
  lessons: [
    {
      id: "l1",
      title: "Bài thử",
      objectives: ["Trình bày được nguyên tắc."],
      sections: [{ id: "s1", title: "Mục một", layout: "text", points: ["Ý chính."], boxes: [], paras: [0, 1, 2] }],
    },
  ],
};

async function user(name: string) {
  const r = await registerUser(
    { email: `ld${Date.now()}${Math.random()}@example.com`, password: "password1234", displayName: name },
    BASE,
  );
  return r.userId;
}

async function setup(personalizationEnabled = false) {
  const owner = await user("Chủ khoá");
  const c = await createCourse(owner, { title: "Khoá nháp", description: "x", personalizationEnabled });
  const m = await createModule(owner, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(owner, m.moduleId, { title: "Bài 1", orderIndex: 0 });
  const next = await createLesson(owner, m.moduleId, { title: "Bài 2 có sẵn", orderIndex: 1 });
  return { owner, lessonId: l.lessonId, moduleId: m.moduleId, nextLessonId: next.lessonId };
}

const RESULT = (n: number): LessonDraftResult => ({
  lessons: Array.from({ length: n }, (_, i) => ({ title: `Bài AI ${i + 1}`, html: `<section class="lesson-section" data-layout="text"><h2>Mục ${i + 1}</h2><p>Nội dung.</p></section>` })),
  fallbackSections: [],
  missingParas: [],
  writing: "keep",
  generatedAt: new Date().toISOString(),
});

const input = { sourceName: "tai-lieu.docx", sourceKind: "docx", sourceParas: PARAS, outline: OUTLINE };

describe("bản nháp tạo bài từ tài liệu", () => {
  it("tạo và đọc lại đúng tài liệu (kể cả ảnh) và dàn ý", async () => {
    const { owner, lessonId } = await setup();
    const d = await createLessonDraft(owner, lessonId, input);
    const back = await getLessonDraft(owner, d.id);
    expect(back.sourceParas).toEqual(PARAS);
    expect(back.outline).toEqual(OUTLINE);
    expect(back.writing).toBe("keep");
    expect(back.addObjectivesSummary).toBe(true);
    expect(back.confirmedAt).toBeNull();
    expect(back.lessonTitle).toBe("Bài 1");
    expect(await getActiveLessonDraftId(owner, lessonId)).toBe(d.id);
  });

  it("người không sửa được khoá thì không tạo được, không thấy bản nháp của người khác", async () => {
    const { owner, lessonId } = await setup();
    const stranger = await user("Người ngoài");
    await expect(createLessonDraft(stranger, lessonId, input)).rejects.toMatchObject({ code: "forbidden" });
    const d = await createLessonDraft(owner, lessonId, input);
    await expect(getLessonDraft(stranger, d.id)).rejects.toBeInstanceOf(LessonDraftError);
    await expect(updateLessonDraft(stranger, d.id, { confirm: true })).rejects.toMatchObject({ code: "not_found" });
  });

  it("tạo bản mới thì bản đang mở trước đó chuyển sang đã bỏ", async () => {
    const { owner, lessonId } = await setup();
    const a = await createLessonDraft(owner, lessonId, input);
    const b = await createLessonDraft(owner, lessonId, input);
    expect(await getActiveLessonDraftId(owner, lessonId)).toBe(b.id);
    expect((await prisma.lessonDraft.findUnique({ where: { id: a.id } }))?.status).toBe("discarded");
  });

  it("chốt rồi sửa dàn ý thì mất chốt; đổi bảng màu thì vẫn giữ chốt (D7)", async () => {
    const { owner, lessonId } = await setup();
    const d = await createLessonDraft(owner, lessonId, input);
    const c1 = await updateLessonDraft(owner, d.id, { confirm: true });
    expect(c1.confirmedAt).not.toBeNull();

    const look = await updateLessonDraft(owner, d.id, { look: { palette: "paper", font: "academic" } });
    expect(look.confirmedAt).not.toBeNull();
    expect(look.look).toEqual({ palette: "paper", font: "academic" });

    const edited = await updateLessonDraft(owner, d.id, {
      outline: { ...OUTLINE, lessons: [{ ...OUTLINE.lessons[0]!, title: "Bài thử (sửa)" }] },
    });
    expect(edited.confirmedAt).toBeNull();
    expect(edited.outline.lessons[0]?.title).toBe("Bài thử (sửa)");

    await updateLessonDraft(owner, d.id, { confirm: true });
    const mode = await updateLessonDraft(owner, d.id, { writing: "edit" });
    expect(mode.writing).toBe("edit");
    expect(mode.confirmedAt).toBeNull();

    const cleared = await updateLessonDraft(owner, d.id, { look: null });
    expect(cleared.look).toBeNull();
  });

  it("bỏ bản nháp: không còn là bản đang mở, không sửa được nữa", async () => {
    const { owner, lessonId } = await setup();
    const d = await createLessonDraft(owner, lessonId, input);
    await discardLessonDraft(owner, d.id);
    expect(await getActiveLessonDraftId(owner, lessonId)).toBeNull();
    await expect(updateLessonDraft(owner, d.id, { confirm: true })).rejects.toMatchObject({ code: "invalid_state" });
  });

  it("lưu kết quả chỉ khi dàn ý đã chốt; sửa dàn ý thì kết quả bị bỏ", async () => {
    const { owner, lessonId } = await setup();
    const d = await createLessonDraft(owner, lessonId, input);
    await expect(saveLessonDraftResult(owner, d.id, RESULT(1))).rejects.toMatchObject({ code: "not_confirmed" });
    await updateLessonDraft(owner, d.id, { confirm: true });
    await saveLessonDraftResult(owner, d.id, RESULT(1));
    expect((await getLessonDraft(owner, d.id)).result?.lessons).toHaveLength(1);
    await updateLessonDraft(owner, d.id, { look: { palette: "forest", font: "readable" } });
    expect((await getLessonDraft(owner, d.id)).result).not.toBeNull();
    await updateLessonDraft(owner, d.id, { writing: "edit" });
    expect((await getLessonDraft(owner, d.id)).result).toBeNull();
  });

  it("Áp dụng: bài 1 thành khối Văn bản cuối bài đang mở, bài sau thành bài mới ẩn ngay sau, có chủ đề tự sinh (T7, T8)", async () => {
    const { owner, lessonId, moduleId, nextLessonId } = await setup(true);
    const d = await createLessonDraft(owner, lessonId, { ...input, look: { palette: "paper", font: "academic" } });
    await expect(applyLessonDraft(owner, d.id)).rejects.toMatchObject({ code: "not_confirmed" });
    await updateLessonDraft(owner, d.id, { confirm: true });
    await expect(applyLessonDraft(owner, d.id)).rejects.toMatchObject({ code: "no_result" });
    await saveLessonDraftResult(owner, d.id, RESULT(3));

    const r = await applyLessonDraft(owner, d.id);
    expect(r.lessonIds[0]).toBe(lessonId);
    expect(r.lessonIds).toHaveLength(3);

    const order = await prisma.lesson.findMany({ where: { moduleId }, orderBy: { orderIndex: "asc" }, select: { id: true, title: true, isHidden: true } });
    expect(order.map((l) => l.id)).toEqual([lessonId, r.lessonIds[1], r.lessonIds[2], nextLessonId]);
    expect(order.slice(1, 3).every((l) => l.isHidden)).toBe(true);
    expect(order[1]!.title).toBe("Bài AI 2");

    const item = await prisma.contentItem.findUnique({ where: { id: r.contentItemIds[0]! } });
    expect(item?.type).toBe("richtext");
    expect(item?.lessonId).toBe(lessonId);
    expect((item?.payload as { look?: unknown }).look).toEqual({ palette: "paper", font: "academic" });
    expect(await prisma.lessonActivity.count({ where: { contentItemId: r.contentItemIds[1]! } })).toBe(1);
    expect(await prisma.contentSkillMapping.count({ where: { contentType: "lesson", contentId: r.lessonIds[1]! } })).toBe(1);

    expect((await prisma.lessonDraft.findUnique({ where: { id: d.id } }))?.status).toBe("applied");
    await expect(applyLessonDraft(owner, d.id)).rejects.toMatchObject({ code: "invalid_state" });
  });

  it("giữ nguyên định dạng: bản nháp có sẵn bài và đã chốt, Áp dụng được ngay không cần dàn ý hay AI", async () => {
    const { owner, lessonId } = await setup();
    const html = "<h2>Mục</h2><p>Nội dung.</p><table><tbody><tr><td>a</td></tr></tbody></table>";
    const d = await createLessonDraft(owner, lessonId, {
      ...input,
      sourceParas: [],
      outline: { ...OUTLINE, keepFormat: true },
      readyResult: { ...RESULT(1), lessons: [{ title: "Tên", html }] },
    });
    expect(d.confirmedAt).not.toBeNull();
    expect(d.result?.lessons[0]?.html).toBe(html);
    expect(d.outline.keepFormat).toBe(true);

    const r = await applyLessonDraft(owner, d.id);
    expect(r.lessonIds).toEqual([lessonId]);
    const item = await prisma.contentItem.findUnique({ where: { id: r.contentItemIds[0]! } });
    expect((item?.payload as { html: string }).html).toContain("<table>");
  });

  it("Áp dụng giữ bản AI tạo trong lịch sử và ghi sự kiện lesson.content.generated (S3, S7)", async () => {
    const { owner, lessonId } = await setup();
    const d = await createLessonDraft(owner, lessonId, input);
    await updateLessonDraft(owner, d.id, { confirm: true });
    await saveLessonDraftResult(owner, d.id, RESULT(1));
    const r = await applyLessonDraft(owner, d.id);
    const v = await prisma.contentItemVersion.findMany({ where: { contentItemId: r.contentItemIds[0]! } });
    expect(v.map((x) => x.source)).toEqual(["generated"]);
    const ev = await prisma.learningEvent.findFirst({ where: { userId: owner, eventType: "lesson.content.generated" } });
    expect(ev?.payload).toMatchObject({ draftId: d.id, sectionCount: 1, replaced: false, writing: "keep" });
  });

  it("Làm lại từ dàn ý: Áp dụng thay nội dung khối cũ, bản cũ vào lịch sử (S4)", async () => {
    const { owner, lessonId } = await setup();
    const old = await prisma.contentItem.create({
      data: { lessonId, type: "richtext", payload: { html: "<p>Bài cũ</p>" }, orderIndex: 0 },
    });
    const d = await createLessonDraft(owner, lessonId, { ...input, targetContentItemId: old.id });
    expect(d.targetContentItemId).toBe(old.id);
    await updateLessonDraft(owner, d.id, { confirm: true });
    await saveLessonDraftResult(owner, d.id, RESULT(1));
    const r = await applyLessonDraft(owner, d.id);
    expect(r.contentItemIds).toEqual([old.id]);
    expect(await prisma.contentItem.count({ where: { lessonId } })).toBe(1);
    const now = await prisma.contentItem.findUnique({ where: { id: old.id } });
    expect((now?.payload as { html: string }).html).toContain("Mục 1");
    const v = await prisma.contentItemVersion.findMany({ where: { contentItemId: old.id }, orderBy: { createdAt: "asc" } });
    expect(v.map((x) => x.source)).toEqual(["before_regenerate", "generated"]);
    expect((v[0]!.payload as { html: string }).html).toBe("<p>Bài cũ</p>");
  });

  it("khối đích phải là khối Văn bản của chính bài học", async () => {
    const a = await setup();
    const b = await setup();
    const foreign = await prisma.contentItem.create({ data: { lessonId: b.lessonId, type: "richtext", payload: { html: "<p>x</p>" }, orderIndex: 0 } });
    await expect(createLessonDraft(a.owner, a.lessonId, { ...input, targetContentItemId: foreign.id })).rejects.toMatchObject({ code: "not_found" });
  });
});
