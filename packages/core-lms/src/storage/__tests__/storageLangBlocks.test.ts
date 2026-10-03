import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  attributeStoredFiles,
  findOrphanedFiles,
  getUserStorageUsageBytes,
  recordStoredFile,
} from "../index";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";

/**
 * LANG G2 / G2.4.1 — audio của TỪNG dòng từ vựng và TỪNG lượt hội thoại nằm sâu
 * trong payload JSON. Sổ dung lượng và bộ dọn mồ côi tìm tham chiếu bằng cách dò
 * tên file trong payload::text, nên phải thấy được chúng; nếu không, audio của
 * khối bị tính nhầm chủ hoặc bị dọn khi vẫn đang dùng.
 */

const BASE = "http://localhost:3000";
const OLD = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

let seq = 0;
const name = (userId: string) => `${userId}-${1790000200000 + ++seq}-${seq.toString(16).padStart(8, "c")}.mp3`;
const url = (f: string) => `/api/lesson-media/audio/${f}`;

async function user(displayName: string) {
  return registerUser(
    { email: `lb-${Date.now()}-${Math.random()}@e.com`, password: "password1234", displayName },
    BASE,
  );
}
async function lessonOf(userId: string) {
  const c = await createCourse(userId, { title: "K", description: "x" });
  const m = await createModule(userId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(userId, m.moduleId, { title: "L", orderIndex: 0 });
  return { courseId: c.courseId, lessonId: l.lessonId };
}
async function stored(key: string, size: number, old = true) {
  await recordStoredFile({ layer: "public", key, sizeBytes: size });
  if (old) await prisma.storedFile.updateMany({ where: { layer: "public", key }, data: { updatedAt: OLD } });
}

describe("audio trong khối từ vựng / hội thoại — sổ dung lượng và dọn mồ côi", () => {
  it("G2.4.1: đồng giảng upload audio cho dòng từ vựng và lượt thoại → dung lượng tính cho CHỦ KHOÁ", async () => {
    const owner = await user("Owner");
    const co = await user("Co");
    const { courseId, lessonId } = await lessonOf(owner.userId);
    await prisma.courseInstructor.create({ data: { courseId, userId: co.userId, role: "co-instructor" } });

    const fv = name(co.userId);
    const fd = name(co.userId);
    await stored(`lesson-media/audio/2026/09/${fv}`, 1000, false);
    await stored(`lesson-media/audio/2026/09/${fd}`, 2000, false);
    expect(await getUserStorageUsageBytes(co.userId)).toBe(3000);

    await prisma.contentItem.create({
      data: { lessonId, type: "vocab_list", orderIndex: 0, payload: { items: [{ id: "i1", term: "a", meaning: "b", audioUrl: url(fv) }] } },
    });
    await prisma.contentItem.create({
      data: { lessonId, type: "dialogue", orderIndex: 1, payload: { turns: [{ id: "t1", speaker: "A", text: "x", audioUrl: url(fd) }] } },
    });
    await attributeStoredFiles();

    expect(await getUserStorageUsageBytes(co.userId)).toBe(0);
    expect(await getUserStorageUsageBytes(owner.userId)).toBe(3000);
    const row = await prisma.storedFile.findUniqueOrThrow({
      where: { layer_key: { layer: "public", key: `lesson-media/audio/2026/09/${fd}` } },
    });
    expect(row.courseId).toBe(courseId);
  });

  it("G2.4.1: audio chỉ được tham chiếu từ một dòng/lượt thì KHÔNG bị coi là mồ côi; audio không ai dùng thì có", async () => {
    const u = await user("Sweeper");
    const { lessonId } = await lessonOf(u.userId);
    const inVocab = name(u.userId);
    const inDialogue = name(u.userId);
    const unused = name(u.userId);
    for (const f of [inVocab, inDialogue, unused]) await stored(`lesson-media/audio/2026/06/${f}`, 500);

    await prisma.contentItem.create({
      data: { lessonId, type: "vocab_list", orderIndex: 0, payload: { items: [{ id: "i1", term: "a", meaning: "b", audioUrl: url(inVocab) }] } },
    });
    await prisma.contentItem.create({
      data: { lessonId, type: "dialogue", orderIndex: 1, payload: { audioUrl: null, turns: [{ id: "t1", speaker: "A", text: "x", audioUrl: url(inDialogue) }] } },
    });

    const keys = (await findOrphanedFiles()).orphans.map((o) => o.key);
    expect(keys).toContain(`lesson-media/audio/2026/06/${unused}`);
    expect(keys).not.toContain(`lesson-media/audio/2026/06/${inVocab}`);
    expect(keys).not.toContain(`lesson-media/audio/2026/06/${inDialogue}`);
  });
});
