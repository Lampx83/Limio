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
 * LANG G2 / G2.1 + G2.4.2 — khối từ vựng (`vocab_list`) và hội thoại (`dialogue`).
 * Mỗi dòng/lượt có `id` ổn định: server gán khi thiếu, giữ nguyên khi đã có, để
 * G4 (flashcard) có khoá không đổi qua các lần sửa.
 */

const BASE = "http://localhost:3000";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const AUDIO = "/api/lesson-media/audio/11111111-2222-4333-8444-555555555555-1790000000000-ab12cd34ef567890.mp3";

async function setup(personalizationEnabled = false) {
  const r = await registerUser(
    { email: `lb${Date.now()}${Math.random()}@example.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  const c = await createCourse(r.userId, { title: "Lang blocks", description: "x", personalizationEnabled });
  const m = await createModule(r.userId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(r.userId, m.moduleId, { title: "Bài 5", orderIndex: 0 });
  return { userId: r.userId, courseId: c.courseId, lessonId: l.lessonId };
}

const vocab = (p: unknown) => validateContentPayload("vocab_list", p) as { items: Array<Record<string, unknown>> } & Record<string, unknown>;
const dialogue = (p: unknown) => validateContentPayload("dialogue", p) as { turns: Array<Record<string, unknown>> } & Record<string, unknown>;
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ term: `t${i}`, meaning: `m${i}` }));

describe("vocab_list — schema (thuần, không cần DB)", () => {
  it("G2.1: payload tối thiểu hợp lệ; server gán id uuid cho dòng thiếu id", () => {
    const out = vocab({ items: [{ term: "你好", meaning: "xin chào" }, { term: "谢谢", meaning: "cảm ơn" }] });
    expect(out.items).toHaveLength(2);
    for (const it of out.items) expect(String(it.id)).toMatch(UUID_RE);
    expect(out.items[0]!.id).not.toBe(out.items[1]!.id);
  });

  it("G2.1.6: id đã có được giữ nguyên", () => {
    const out = vocab({ items: [{ id: ID_A, term: "你好", meaning: "xin chào" }] });
    expect(out.items[0]!.id).toBe(ID_A);
  });

  it("nhận đủ trường: tiêu đề, nhãn phiên âm, ví dụ, ghi chú, audio", () => {
    const out = vocab({
      title: "Từ mới bài 5",
      readingLabel: "Pinyin",
      items: [
        {
          term: "朋友", reading: "péngyou", meaning: "bạn bè",
          example: "他是我的朋友。", exampleReading: "Tā shì wǒ de péngyou.", exampleMeaning: "Anh ấy là bạn của tôi.",
          note: "Thanh nhẹ ở âm tiết sau", audioUrl: AUDIO,
        },
      ],
    });
    expect(out.readingLabel).toBe("Pinyin");
    expect(out.items[0]).toMatchObject({ reading: "péngyou", audioUrl: AUDIO });
  });

  it("G2.1.1: thiếu term hoặc meaning, hoặc chỉ có khoảng trắng, bị từ chối", () => {
    // Đối chứng: payload hợp lệ phải qua để các ca từ chối bên dưới có nghĩa.
    expect(() => vocab({ items: [{ term: "a", meaning: "b" }] })).not.toThrow();
    for (const bad of [
      { meaning: "b" },
      { term: "a" },
      { term: "", meaning: "b" },
      { term: "a", meaning: "" },
      { term: "   ", meaning: "b" },
      { term: "a", meaning: "\n\t " },
    ]) {
      expect(() => vocab({ items: [bad] }), JSON.stringify(bad)).toThrow();
    }
  });

  it("G2.1.3: danh sách rỗng bị từ chối; đúng 300 dòng thì nhận, 301 thì không", () => {
    expect(() => vocab({ items: [] })).toThrow();
    expect(() => vocab({ items: rows(300) })).not.toThrow();
    expect(() => vocab({ items: rows(301) })).toThrow();
  });

  it("G2.1.3: giới hạn độ dài từng trường", () => {
    const ok = (extra: Record<string, unknown>) => vocab({ items: [{ term: "a", meaning: "b", ...extra }] });
    expect(() => ok({ term: "x".repeat(200), reading: "x".repeat(200), meaning: "x".repeat(500), example: "x".repeat(1000), note: "x".repeat(500) })).not.toThrow();
    expect(() => ok({ term: "x".repeat(201) })).toThrow();
    expect(() => ok({ reading: "x".repeat(201) })).toThrow();
    expect(() => ok({ meaning: "x".repeat(501) })).toThrow();
    expect(() => ok({ example: "x".repeat(1001) })).toThrow();
    expect(() => ok({ exampleReading: "x".repeat(1001) })).toThrow();
    expect(() => ok({ exampleMeaning: "x".repeat(1001) })).toThrow();
    expect(() => ok({ note: "x".repeat(501) })).toThrow();
    expect(() => vocab({ title: "x".repeat(201), items: rows(1) })).toThrow();
    expect(() => vocab({ readingLabel: "x".repeat(41), items: rows(1) })).toThrow();
  });

  it("G2.1.2: id trùng nhau hoặc không phải uuid bị từ chối", () => {
    expect(() => vocab({ items: [{ id: ID_A, term: "a", meaning: "b" }, { id: ID_B, term: "c", meaning: "d" }] })).not.toThrow();
    expect(() => vocab({ items: [{ id: ID_A, term: "a", meaning: "b" }, { id: ID_A, term: "c", meaning: "d" }] })).toThrow();
    expect(() => vocab({ items: [{ id: "not-a-uuid", term: "a", meaning: "b" }] })).toThrow();
  });

  it("G2.1.4: audioUrl theo luật của G1 (cùng-origin hoặc https)", () => {
    const withAudio = (audioUrl: string) => vocab({ items: [{ term: "a", meaning: "b", audioUrl }] });
    expect(() => withAudio(AUDIO)).not.toThrow();
    expect(() => withAudio("https://cdn.example.com/a.mp3")).not.toThrow();
    for (const bad of ["http://cdn.example.com/a.mp3", "javascript:alert(1)", "data:audio/mpeg;base64,AA", "//evil.example.com/a.mp3", "a.mp3"]) {
      expect(() => withAudio(bad), bad).toThrow();
    }
  });
});

describe("dialogue — schema (thuần, không cần DB)", () => {
  const turn = (extra: Record<string, unknown> = {}) => ({ speaker: "A", text: "你好！", ...extra });

  it("payload tối thiểu hợp lệ; server gán id cho lượt thiếu id", () => {
    const out = dialogue({ turns: [turn(), turn({ speaker: "B", text: "你好，好久不见。" })] });
    expect(out.turns).toHaveLength(2);
    for (const t of out.turns) expect(String(t.id)).toMatch(UUID_RE);
  });

  it("nhận đủ trường: tiêu đề, chú thích, audio cả bài, phiên âm, bản dịch, audio từng lượt", () => {
    const out = dialogue({
      title: "Hội thoại bài 5",
      caption: "Nghe hai lần rồi xem bản dịch.",
      audioUrl: AUDIO,
      readingLabel: "Pinyin",
      turns: [turn({ id: ID_A, reading: "Nǐ hǎo!", translation: "Xin chào!", audioUrl: AUDIO })],
    });
    expect(out.turns[0]).toMatchObject({ id: ID_A, translation: "Xin chào!", audioUrl: AUDIO });
    expect(out.audioUrl).toBe(AUDIO);
  });

  it("G2.1.5: thiếu speaker hoặc text, hoặc chỉ khoảng trắng, bị từ chối", () => {
    expect(() => dialogue({ turns: [turn()] })).not.toThrow();
    for (const bad of [{ text: "x" }, { speaker: "A" }, { speaker: "", text: "x" }, { speaker: "A", text: "  " }, { speaker: "  ", text: "x" }]) {
      expect(() => dialogue({ turns: [bad] }), JSON.stringify(bad)).toThrow();
    }
  });

  it("G2.1.3: rỗng bị từ chối; 100 lượt nhận, 101 không; giới hạn độ dài", () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => turn({ text: `t${i}` }));
    expect(() => dialogue({ turns: [] })).toThrow();
    expect(() => dialogue({ turns: many(100) })).not.toThrow();
    expect(() => dialogue({ turns: many(101) })).toThrow();
    expect(() => dialogue({ turns: [turn({ speaker: "x".repeat(40) })] })).not.toThrow();
    expect(() => dialogue({ turns: [turn({ speaker: "x".repeat(41) })] })).toThrow();
    expect(() => dialogue({ turns: [turn({ text: "x".repeat(1000) })] })).not.toThrow();
    expect(() => dialogue({ turns: [turn({ text: "x".repeat(1001) })] })).toThrow();
    expect(() => dialogue({ turns: [turn({ translation: "x".repeat(1001) })] })).toThrow();
    expect(() => dialogue({ caption: "x".repeat(601), turns: [turn()] })).toThrow();
  });

  it("G2.1.2: id trùng bị từ chối", () => {
    expect(() => dialogue({ turns: [turn({ id: ID_A }), turn({ id: ID_B })] })).not.toThrow();
    expect(() => dialogue({ turns: [turn({ id: ID_A }), turn({ id: ID_A })] })).toThrow();
  });

  it("G2.1.4: audioUrl ở lượt và ở cả bài theo luật AudioUrl", () => {
    expect(() => dialogue({ turns: [turn({ audioUrl: AUDIO })] })).not.toThrow();
    for (const bad of ["http://x/a.mp3", "javascript:alert(1)", "//evil.example.com/a.mp3"]) {
      expect(() => dialogue({ turns: [turn({ audioUrl: bad })] }), bad).toThrow();
      expect(() => dialogue({ audioUrl: bad, turns: [turn()] }), bad).toThrow();
    }
  });
});

describe("createContentItem / updateContentItem — vocab_list và dialogue", () => {
  it("G2.1.7: enum có cả hai giá trị; tạo xong đọc lại đúng loại, id đã được gán và lưu", async () => {
    const { userId, lessonId } = await setup();
    const v = await createContentItem(userId, lessonId, {
      type: "vocab_list", orderIndex: 0,
      payload: { items: [{ term: "你好", meaning: "xin chào" }] },
    });
    const d = await createContentItem(userId, lessonId, {
      type: "dialogue", orderIndex: 1,
      payload: { turns: [{ speaker: "A", text: "你好！" }] },
    });
    const vRow = await prisma.contentItem.findUniqueOrThrow({ where: { id: v.contentItemId } });
    const dRow = await prisma.contentItem.findUniqueOrThrow({ where: { id: d.contentItemId } });
    expect(vRow.type).toBe("vocab_list");
    expect(dRow.type).toBe("dialogue");
    expect(String((vRow.payload as { items: Array<{ id: string }> }).items[0]!.id)).toMatch(UUID_RE);
    expect(String((dRow.payload as { turns: Array<{ id: string }> }).turns[0]!.id)).toMatch(UUID_RE);
  });

  it("payload sai bị từ chối bằng validation_failed (kèm ca hợp lệ đối chứng)", async () => {
    const { userId, lessonId } = await setup();
    await createContentItem(userId, lessonId, { type: "vocab_list", orderIndex: 0, payload: { items: rows(1) } });
    await expect(
      createContentItem(userId, lessonId, { type: "vocab_list", orderIndex: 1, payload: { items: [{ term: "a" }] } }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    await expect(
      createContentItem(userId, lessonId, { type: "dialogue", orderIndex: 2, payload: { turns: [] } }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("G2.1.6: sửa khối — id của dòng còn lại không đổi, dòng mới nhận id mới, xoá dòng thì id biến mất", async () => {
    const { userId, lessonId } = await setup();
    const created = await createContentItem(userId, lessonId, {
      type: "vocab_list", orderIndex: 0,
      payload: { items: [{ term: "a", meaning: "1" }, { term: "b", meaning: "2" }, { term: "c", meaning: "3" }] },
    });
    const read = async () =>
      (await prisma.contentItem.findUniqueOrThrow({ where: { id: created.contentItemId } })).payload as {
        items: Array<{ id: string; term: string; meaning: string }>;
      };
    const before = (await read()).items;
    const [a, b, c] = before as [typeof before[0], typeof before[0], typeof before[0]];

    // Đổi nghĩa của b, đảo thứ tự a/c, xoá b khỏi giữa rồi thêm d (không id).
    await updateContentItem(userId, created.contentItemId, {
      payload: { items: [c, { ...b, meaning: "2-sửa" }, a, { term: "d", meaning: "4" }] },
    });
    const after = (await read()).items;
    expect(after.map((i) => i.term)).toEqual(["c", "b", "a", "d"]);
    expect(after[0]!.id).toBe(c.id);
    expect(after[1]!.id).toBe(b.id);
    expect(after[1]!.meaning).toBe("2-sửa");
    expect(after[2]!.id).toBe(a.id);
    expect(after[3]!.id).toMatch(UUID_RE);
    expect([a.id, b.id, c.id]).not.toContain(after[3]!.id);

    await updateContentItem(userId, created.contentItemId, { payload: { items: [a] } });
    const last = (await read()).items;
    expect(last.map((i) => i.id)).toEqual([a.id]);
  });
});

describe("G2.4.2 — không phá lesson-as-tag", () => {
  it("khoá bật personalization: thêm vocab_list/dialogue không sinh thêm Skill hay mapping", async () => {
    const { userId, lessonId } = await setup(true);
    expect(await prisma.contentSkillMapping.count({ where: { contentType: "lesson", contentId: lessonId } })).toBe(1);
    const skills = await prisma.skill.count();
    await createContentItem(userId, lessonId, { type: "vocab_list", orderIndex: 0, payload: { items: rows(2) } });
    await createContentItem(userId, lessonId, { type: "dialogue", orderIndex: 1, payload: { turns: [{ speaker: "A", text: "x" }] } });
    expect(await prisma.contentSkillMapping.count({ where: { contentType: "lesson", contentId: lessonId } })).toBe(1);
    expect(await prisma.skill.count({ where: { code: lessonSkillCode(lessonId) } })).toBe(1);
    expect(await prisma.skill.count()).toBe(skills);
  });

  it("khoá thường: thêm hai loại khối này không sinh dòng skill nào", async () => {
    const { userId, lessonId } = await setup(false);
    const skills = await prisma.skill.count();
    await createContentItem(userId, lessonId, { type: "vocab_list", orderIndex: 0, payload: { items: rows(1) } });
    expect(await prisma.skill.count()).toBe(skills);
    expect(await prisma.contentSkillMapping.count({ where: { contentType: "lesson", contentId: lessonId } })).toBe(0);
  });
});

describe("dialogue — mốc thời gian startSec (LANG K2a, thuần)", () => {
  const T = (speaker: string, startSec?: number) => ({ speaker, text: `lời ${speaker}`, ...(startSec === undefined ? {} : { startSec }) });

  it("K2a.1: startSec tuỳ chọn; hội thoại cũ không có mốc vẫn hợp lệ và không bị thêm trường", () => {
    const out = dialogue({ turns: [T("A"), T("B")] });
    expect(out.turns.every((t) => !("startSec" in t))).toBe(true);
  });

  it("K2a.1: nhận số giây ≥ 0, làm tròn 0,1 giây; 0 là hợp lệ", () => {
    const out = dialogue({ audioUrl: "/api/lesson-media/audio/a.mp3", turns: [T("A", 0), T("B", 3.14159), T("A", 7.96)] });
    expect(out.turns.map((t) => t.startSec)).toEqual([0, 3.1, 8]);
  });

  it("K2a.1: từ chối số âm, không phải số, vô hạn, hoặc quá 6 giờ", () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, 21_601, "3"]) {
      expect(() => dialogue({ turns: [{ ...T("A"), startSec: bad }] }), String(bad)).toThrow();
    }
    expect(() => dialogue({ turns: [T("A", 21_600)] })).not.toThrow();
  });

  it("K2a.2: các lượt CÓ mốc phải tăng dần; lượt không mốc ở giữa không cản", () => {
    expect(() => dialogue({ turns: [T("A", 1), T("B"), T("A", 5), T("B", 9)] })).not.toThrow();
  });

  it("K2a.2: mốc giảm hoặc trùng bị từ chối, và lời nhắn chỉ ra lượt nào", () => {
    expect(() => dialogue({ turns: [T("A", 5), T("B", 2)] })).toThrowError(/lượt 2/i);
    expect(() => dialogue({ turns: [T("A", 5), T("B"), T("A", 5)] })).toThrowError(/lượt 3/i);
  });

  it("K2a.2: có mốc mà không có audio cả đoạn vẫn lưu được (không dùng tới)", () => {
    expect(() => dialogue({ turns: [T("A", 1), T("B", 4)] })).not.toThrow();
  });
});
