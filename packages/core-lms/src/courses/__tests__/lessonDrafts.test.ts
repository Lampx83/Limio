import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import type { LessonOutline, SourcePara } from "@feedbackme/shared-types";
import { createCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import {
  LessonDraftError,
  createLessonDraft,
  discardLessonDraft,
  getActiveLessonDraftId,
  getLessonDraft,
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

async function setup() {
  const owner = await user("Chủ khoá");
  const c = await createCourse(owner, { title: "Khoá nháp", description: "x" });
  const m = await createModule(owner, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(owner, m.moduleId, { title: "Bài 1", orderIndex: 0 });
  return { owner, lessonId: l.lessonId };
}

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
});
