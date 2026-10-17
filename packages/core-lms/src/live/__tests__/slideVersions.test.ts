import { describe, expect, it } from "vitest";
import { prisma, type LiveSlideType } from "@feedbackme/db";
import {
  MAX_OTHER_VERSIONS,
  VERSION_COALESCE_MS,
  listSlideVersions,
  recordSlideVersion,
  restoreSlideVersion,
} from "../slideVersions";

function code() {
  return Math.random().toString(36).slice(2, 8);
}
async function makeUser(tag: string) {
  return prisma.user.create({ data: { email: `${tag}-${code()}@example.com`, displayName: tag } });
}
async function makeSlide(userId: string, config: Record<string, unknown> = { layout: "cards", title: "Bản 1" }) {
  const deck = await prisma.liveDeck.create({ data: { userId, title: "Bài" } });
  return prisma.liveSlide.create({ data: { deckId: deck.id, type: "content", orderIndex: 0, config: config as object } });
}
const snap = (s: { id: string; type: LiveSlideType; config: unknown }) => ({ id: s.id, type: s.type, config: s.config });

describe("recordSlideVersion", () => {
  it("chụp trạng thái cũ; nội dung giống hệt bản mới nhất thì không ghi lại", async () => {
    const t = await makeUser("gv");
    const s = await makeSlide(t.id);
    expect(await recordSlideVersion(prisma, snap(s), "before_edit")).toBe(true);
    expect(await recordSlideVersion(prisma, snap(s), "before_ai")).toBe(false);
    expect(await prisma.liveSlideVersion.count({ where: { slideId: s.id } })).toBe(1);
  });

  it("các lần sửa tay liên tiếp trong cửa sổ gộp chỉ giữ trạng thái trước cả đợt sửa", async () => {
    const t = await makeUser("gv");
    const s = await makeSlide(t.id, { title: "Gốc" });
    const t0 = new Date("2026-10-17T10:00:00Z");
    expect(await recordSlideVersion(prisma, snap({ ...s, config: { title: "Gốc" } }), "before_edit", t0)).toBe(true);
    const t1 = new Date(t0.getTime() + 60_000);
    expect(await recordSlideVersion(prisma, snap({ ...s, config: { title: "Gốc 1" } }), "before_edit", t1)).toBe(false);
    const t2 = new Date(t0.getTime() + VERSION_COALESCE_MS + 1000);
    expect(await recordSlideVersion(prisma, snap({ ...s, config: { title: "Gốc 2" } }), "before_edit", t2)).toBe(true);
    const v = await listSlideVersions(prisma, s.id, t.id);
    expect(v.map((x) => (x.config as { title: string }).title)).toEqual(["Gốc 2", "Gốc"]);
  });

  it("bản AI sinh luôn được ghi và không bị dọn khi vượt giới hạn", async () => {
    const t = await makeUser("gv");
    const s = await makeSlide(t.id, { title: "AI" });
    await recordSlideVersion(prisma, snap({ ...s, config: { title: "AI" } }), "generated", new Date("2026-10-17T09:00:00Z"));
    for (let i = 0; i < MAX_OTHER_VERSIONS + 5; i++) {
      await recordSlideVersion(prisma, snap({ ...s, config: { title: `Sửa ${i}` } }), "before_ai", new Date(2026, 9, 17, 10, i));
    }
    const rows = await prisma.liveSlideVersion.findMany({ where: { slideId: s.id } });
    expect(rows.filter((r) => r.source === "generated")).toHaveLength(1);
    expect(rows.filter((r) => r.source !== "generated")).toHaveLength(MAX_OTHER_VERSIONS);
    // Các bản bị dọn là bản cũ nhất.
    const titles = rows.filter((r) => r.source !== "generated").map((r) => (r.config as { title: string }).title);
    expect(titles).not.toContain("Sửa 0");
    expect(titles).toContain(`Sửa ${MAX_OTHER_VERSIONS + 4}`);
  });
});

describe("restoreSlideVersion", () => {
  it("khôi phục nguyên văn config và loại slide, và chụp trạng thái hiện tại để hoàn tác được", async () => {
    const t = await makeUser("gv");
    const s = await makeSlide(t.id, { layout: "cards", title: "Bản AI", aiGenerated: true, outlineId: "o1" });
    await recordSlideVersion(prisma, snap(s), "generated");
    const gen = (await prisma.liveSlideVersion.findFirst({ where: { slideId: s.id } }))!;
    // Giảng viên sửa tay và đổi thành quiz.
    await prisma.liveSlide.update({
      where: { id: s.id },
      data: { type: "quiz", config: { question: "Q?", options: [{ text: "A", correct: true }, { text: "B" }], editedByUser: true } },
    });

    const restored = await restoreSlideVersion(prisma, s.id, gen.id, t.id);
    expect(restored.type).toBe("content");
    expect(restored.config).toEqual({ layout: "cards", title: "Bản AI", aiGenerated: true, outlineId: "o1" });

    const versions = await listSlideVersions(prisma, s.id, t.id);
    const before = versions.find((v) => v.source === "before_restore")!;
    expect(before.type).toBe("quiz");
    // Khôi phục lần nữa về bản "trước khi khôi phục" thì quay lại đúng bản quiz đã sửa.
    const back = await restoreSlideVersion(prisma, s.id, before.id, t.id);
    expect(back.type).toBe("quiz");
    expect((back.config as { question: string }).question).toBe("Q?");
  });

  it("người khác không xem hay khôi phục được; phiên bản của slide khác không dùng được", async () => {
    const owner = await makeUser("gv");
    const other = await makeUser("khac");
    const a = await makeSlide(owner.id);
    const b = await makeSlide(owner.id, { title: "B" });
    await recordSlideVersion(prisma, snap(a), "before_edit");
    const v = (await prisma.liveSlideVersion.findFirst({ where: { slideId: a.id } }))!;
    await expect(listSlideVersions(prisma, a.id, other.id)).rejects.toThrow(/Not authorized/);
    await expect(restoreSlideVersion(prisma, a.id, v.id, other.id)).rejects.toThrow(/Not authorized/);
    await expect(restoreSlideVersion(prisma, b.id, v.id, owner.id)).rejects.toThrow(/Version not found/);
  });

  it("xoá slide thì phiên bản đi theo", async () => {
    const t = await makeUser("gv");
    const s = await makeSlide(t.id);
    await recordSlideVersion(prisma, snap(s), "generated");
    await prisma.liveSlide.delete({ where: { id: s.id } });
    expect(await prisma.liveSlideVersion.count({ where: { slideId: s.id } })).toBe(0);
  });
});
