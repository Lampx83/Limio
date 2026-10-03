import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  attributeStoredFiles,
  classifyStorageKey,
  findOrphanedFiles,
  getStorageUsageReport,
  getUserStorageUsageBytes,
  recordStoredFile,
  uploaderFromStorageKey,
} from "../index";
import { SWEEPABLE_KINDS } from "../orphans";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";

/**
 * LANG G1 / AUD.4.1–4.2 — audio bài học phải đi đúng qua sổ dung lượng, gán chủ
 * khoá và dọn file mồ côi. Thiếu `lesson_audio` ở BẤT KỲ chỗ nào trong ba chỗ này
 * thì audio rơi vào "other": không tính quota đúng chủ, không bao giờ được dọn,
 * hoặc tệ hơn là bị dọn khi vẫn đang dùng.
 */

const BASE = "http://localhost:3000";
const OLD = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
const uid = "11111111-2222-4333-8444-555555555555";

let seq = 0;
const name = (userId: string, ext = "mp3") => `${userId}-${1790000100000 + ++seq}-${seq.toString(16).padStart(8, "b")}.${ext}`;

async function user(displayName: string) {
  return registerUser(
    { email: `a-${Date.now()}-${Math.random()}@e.com`, password: "password1234", displayName },
    BASE,
  );
}

async function lessonOf(userId: string) {
  const c = await createCourse(userId, { title: "K", description: "x" });
  const m = await createModule(userId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(userId, m.moduleId, { title: "L", orderIndex: 0 });
  return { courseId: c.courseId, lessonId: l.lessonId };
}

describe("classifyStorageKey — audio (thuần, không cần DB)", () => {
  it("AUD.4.1: lesson-media/audio/ → lesson_audio, không rơi vào other", () => {
    expect(classifyStorageKey("public", "lesson-media/audio/2026/09/x.mp3")).toBe("lesson_audio");
    expect(classifyStorageKey("tmp", "2026-09-29/s/lesson-media/audio/x.mp3")).toBe("tmp");
  });

  it("AUD.4.1: suy được người upload từ tên file audio", () => {
    expect(uploaderFromStorageKey(`lesson-media/audio/2026/09/${uid}-1790000000000-ab12cd34ef567890.m4a`)).toBe(uid);
  });

  it("AUD.4.2: lesson_audio nằm trong danh sách loại được phép dọn", () => {
    expect(SWEEPABLE_KINDS).toContain("lesson_audio");
  });
});

describe("audio qua sổ dung lượng (cần DB)", () => {
  it("AUD.4.1: đồng giảng upload audio vào bài → sau khi gán theo tham chiếu, dung lượng tính cho CHỦ KHOÁ", async () => {
    const owner = await user("Owner");
    const co = await user("Co");
    const { courseId, lessonId } = await lessonOf(owner.userId);
    await prisma.courseInstructor.create({ data: { courseId, userId: co.userId, role: "co-instructor" } });

    const filename = name(co.userId);
    const key = `lesson-media/audio/2026/09/${filename}`;
    await recordStoredFile({ layer: "public", key, sizeBytes: 3000 });
    expect(await getUserStorageUsageBytes(co.userId)).toBe(3000);

    await prisma.contentItem.create({
      data: { lessonId, type: "audio", orderIndex: 0, payload: { url: `/api/lesson-media/audio/${filename}` } },
    });
    await attributeStoredFiles();

    expect(await getUserStorageUsageBytes(co.userId)).toBe(0);
    expect(await getUserStorageUsageBytes(owner.userId)).toBe(3000);
    const row = await prisma.storedFile.findUniqueOrThrow({ where: { layer_key: { layer: "public", key } } });
    expect(row.courseId).toBe(courseId);
    expect(row.attribution).toBe("reference:content_item");
  });

  it("AUD.4.1: báo cáo dung lượng có dòng riêng 'lesson_audio'", async () => {
    const u = await user("Reporter");
    await recordStoredFile({
      layer: "public",
      key: `lesson-media/audio/2026/09/${name(u.userId)}`,
      sizeBytes: 12345,
    });
    const r = await getStorageUsageReport({ topN: 5 });
    const audio = r.byKind.find((k) => k.kind === "lesson_audio");
    expect(audio).toBeDefined();
    expect(audio!.files).toBeGreaterThanOrEqual(1);
    expect(audio!.bytes).toBeGreaterThanOrEqual(12345);
  });
});

describe("AUD.4.2 — dọn file mồ côi với audio", () => {
  it("audio cũ không ai dùng bị chọn; audio còn được bài học dùng thì giữ", async () => {
    const u = await user("Sweeper");
    const { lessonId } = await lessonOf(u.userId);
    const used = name(u.userId);
    const orphan = name(u.userId, "m4a");
    for (const [f, size] of [[used, 1000], [orphan, 7000]] as const) {
      const key = `lesson-media/audio/2026/06/${f}`;
      await recordStoredFile({ layer: "public", key, sizeBytes: size });
      await prisma.storedFile.updateMany({ where: { layer: "public", key }, data: { updatedAt: OLD } });
    }
    await prisma.contentItem.create({
      data: { lessonId, type: "audio", orderIndex: 0, payload: { url: `/api/lesson-media/audio/${used}` } },
    });

    const scan = await findOrphanedFiles();
    const keys = scan.orphans.map((o) => o.key);
    expect(keys).toContain(`lesson-media/audio/2026/06/${orphan}`);
    expect(keys).not.toContain(`lesson-media/audio/2026/06/${used}`);
  });

  it("audio mới upload (chưa kịp lưu vào bài) chưa bị coi là mồ côi", async () => {
    const u = await user("Fresh");
    // Một audio "đang được dùng" để lần quét luôn có ít nhất một tham chiếu
    // (chốt chặn quét-rỗng của findOrphanedFiles), kể cả khi chạy test này riêng.
    const { lessonId } = await lessonOf(u.userId);
    const anchor = name(u.userId);
    const anchorKey = `lesson-media/audio/2026/06/${anchor}`;
    await recordStoredFile({ layer: "public", key: anchorKey, sizeBytes: 100 });
    await prisma.storedFile.updateMany({ where: { layer: "public", key: anchorKey }, data: { updatedAt: OLD } });
    await prisma.contentItem.create({
      data: { lessonId, type: "audio", orderIndex: 0, payload: { url: `/api/lesson-media/audio/${anchor}` } },
    });

    const f = name(u.userId);
    await recordStoredFile({ layer: "public", key: `lesson-media/audio/2026/09/${f}`, sizeBytes: 500 });
    const scan = await findOrphanedFiles();
    expect(scan.orphans.map((o) => o.key)).not.toContain(`lesson-media/audio/2026/09/${f}`);
  });
});
