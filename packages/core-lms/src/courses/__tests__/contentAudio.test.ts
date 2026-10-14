import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { lessonSkillCode } from "@feedbackme/shared-types";
import { createCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { createContentItem, updateContentItem } from "../contents";
import { validateContentPayload } from "../contentSchemas";
import { registerUser } from "../../auth/register";

/**
 * LANG G1 / AUD.3 + AUD.4.3–4.4 — loại nội dung `audio`.
 *
 * Payload: { url, title?, caption?, transcript?, showTranscript?, durationSec? }.
 * `url` chặt hơn các loại khác một bước có chủ ý: chỉ nhận đường dẫn cùng-origin
 * hoặc https — audio http trên trang https bị trình duyệt chặn (mixed content),
 * nên nhận vào chỉ là nhận một bài nghe sẽ im lặng.
 */

const BASE = "http://localhost:3000";
const UPLOADED = "/api/lesson-media/audio/11111111-2222-4333-8444-555555555555-1790000000000-ab12cd34ef567890.mp3";

async function setup(personalizationEnabled = false) {
  const r = await registerUser(
    { email: `au${Date.now()}${Math.random()}@example.com`, password: "password1234", displayName: "A" },
    BASE,
  );
  const c = await createCourse(r.userId, { title: "Audio tests", description: "x", personalizationEnabled });
  const m = await createModule(r.userId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(r.userId, m.moduleId, { title: "Hội thoại bài 5", orderIndex: 0 });
  return { userId: r.userId, courseId: c.courseId, lessonId: l.lessonId };
}

describe("AudioPayload — kiểm tra schema (thuần, không cần DB)", () => {
  const ok = (p: unknown) => validateContentPayload("audio", p);

  it("AUD.3.2: chỉ cần url; nhận đường dẫn file tự upload", () => {
    expect(ok({ url: UPLOADED })).toMatchObject({ url: UPLOADED });
  });

  it("nhận đủ trường: tiêu đề, chú thích, lời thoại, cờ ẩn lời thoại, thời lượng", () => {
    const p = ok({
      url: "https://cdn.example.com/bai5.mp3",
      title: "Hội thoại bài 5",
      caption: "Nghe hai lần rồi mới xem lời thoại.",
      transcript: "A：你好！\nB：你好，好久不见。",
      showTranscript: false,
      durationSec: 95,
    });
    expect(p).toMatchObject({ showTranscript: false, durationSec: 95 });
  });

  it("AUD.2.5: url ngoài chỉ nhận https", () => {
    expect(() => ok({ url: "https://cdn.example.com/a.mp3" })).not.toThrow();
    for (const bad of [
      "http://cdn.example.com/a.mp3",
      "javascript:alert(1)",
      "data:audio/mpeg;base64,AAAA",
      "ftp://x/a.mp3",
      "//evil.example.com/a.mp3", // protocol-relative: bắt đầu bằng "/" nhưng KHÔNG cùng origin
      "a.mp3",
      "",
    ]) {
      expect(() => ok({ url: bad }), bad).toThrow();
    }
  });

  it("AUD.3.2: thiếu url, tiêu đề quá dài, lời thoại quá dài, thời lượng không hợp lệ đều bị từ chối", () => {
    // Đối chứng: payload hợp lệ phải qua, nếu không thì "bị từ chối" bên dưới
    // chỉ chứng minh loại audio chưa tồn tại chứ không chứng minh luật.
    expect(() => ok({ url: UPLOADED, title: "x".repeat(200), transcript: "x".repeat(20_000), durationSec: 1 })).not.toThrow();
    expect(() => ok({})).toThrow();
    expect(() => ok({ url: UPLOADED, title: "x".repeat(201) })).toThrow();
    expect(() => ok({ url: UPLOADED, caption: "x".repeat(601) })).toThrow();
    expect(() => ok({ url: UPLOADED, transcript: "x".repeat(20_001) })).toThrow();
    for (const durationSec of [0, -5, 1.5]) {
      expect(() => ok({ url: UPLOADED, durationSec }), String(durationSec)).toThrow();
    }
  });
});

describe("createContentItem / updateContentItem — loại audio", () => {
  it("AUD.4.3: enum ContentType có `audio`; tạo xong đọc lại đúng loại và payload", async () => {
    const { userId, lessonId } = await setup();
    const item = await createContentItem(userId, lessonId, {
      type: "audio",
      orderIndex: 0,
      payload: { url: UPLOADED, title: "Bài nghe 5", showTranscript: false, transcript: "你好" },
    });
    const row = await prisma.contentItem.findUniqueOrThrow({ where: { id: item.contentItemId } });
    expect(row.type).toBe("audio");
    expect(row.payload).toMatchObject({ url: UPLOADED, title: "Bài nghe 5", showTranscript: false });
  });

  it("AUD.3.2: payload thiếu url bị từ chối bằng validation_failed", async () => {
    const { userId, lessonId } = await setup();
    // Đối chứng: có url thì tạo được (để lỗi bên dưới đúng là do thiếu url).
    await createContentItem(userId, lessonId, { type: "audio", orderIndex: 0, payload: { url: UPLOADED } });
    await expect(
      createContentItem(userId, lessonId, { type: "audio", orderIndex: 1, payload: { title: "Không có file" } }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("AUD.3.3: sửa tiêu đề và lời thoại giữ nguyên url; bỏ mất url thì bị từ chối", async () => {
    const { userId, lessonId } = await setup();
    const item = await createContentItem(userId, lessonId, {
      type: "audio",
      orderIndex: 0,
      payload: { url: UPLOADED, title: "Cũ" },
    });
    await updateContentItem(userId, item.contentItemId, {
      payload: { url: UPLOADED, title: "Mới", transcript: "你好，谢谢" },
    });
    const row = await prisma.contentItem.findUniqueOrThrow({ where: { id: item.contentItemId } });
    expect(row.payload).toMatchObject({ url: UPLOADED, title: "Mới", transcript: "你好，谢谢" });

    await expect(
      updateContentItem(userId, item.contentItemId, { payload: { title: "Mất file" } }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("AUD.3.4: ẩn audio khỏi học viên như mọi loại khác (isHidden)", async () => {
    const { userId, lessonId } = await setup();
    const item = await createContentItem(userId, lessonId, {
      type: "audio",
      orderIndex: 0,
      payload: { url: UPLOADED },
    });
    await prisma.contentItem.update({ where: { id: item.contentItemId }, data: { isHidden: true } });
    const row = await prisma.contentItem.findUniqueOrThrow({ where: { id: item.contentItemId } });
    expect(row.isHidden).toBe(true);
  });
});

describe("AUD.4.4 — audio không phá lesson-as-tag", () => {
  it("khoá bật personalization: thêm audio vào bài không sinh thêm Skill hay mapping; tag của bài vẫn đúng 1", async () => {
    const { userId, lessonId } = await setup(true);
    const before = await prisma.contentSkillMapping.count({ where: { contentType: "lesson", contentId: lessonId } });
    expect(before).toBe(1);
    const skillsBefore = await prisma.skill.count();

    await createContentItem(userId, lessonId, { type: "audio", orderIndex: 0, payload: { url: UPLOADED } });

    expect(await prisma.contentSkillMapping.count({ where: { contentType: "lesson", contentId: lessonId } })).toBe(1);
    expect(await prisma.skill.count({ where: { code: lessonSkillCode(lessonId) } })).toBe(1);
    expect(await prisma.skill.count()).toBe(skillsBefore);
  });

  it("khoá thường (personalization tắt): thêm audio không sinh dòng skill nào", async () => {
    const { userId, lessonId } = await setup(false);
    const skillsBefore = await prisma.skill.count();
    await createContentItem(userId, lessonId, { type: "audio", orderIndex: 0, payload: { url: UPLOADED } });
    expect(await prisma.skill.count()).toBe(skillsBefore);
    expect(await prisma.contentSkillMapping.count({ where: { contentType: "lesson", contentId: lessonId } })).toBe(0);
  });
});
