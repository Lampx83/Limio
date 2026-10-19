import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { getLiveDeckByShareCode, setLiveDeckSharing } from "../share";
import { duplicateLiveDeck } from "../decks";

function uniqueCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function makeUser(tag: string) {
  return prisma.user.create({
    data: { email: `${tag}-${uniqueCode()}@example.com`, displayName: tag },
  });
}

async function makeDeck(userId: string) {
  const deck = await prisma.liveDeck.create({
    data: { userId, title: "Bài chia sẻ", outline: { rows: [] }, sourceText: "Tài liệu gốc bí mật" },
  });
  await prisma.liveSlide.create({ data: { deckId: deck.id, type: "content", orderIndex: 2, config: { title: "Hai" } } });
  await prisma.liveSlide.create({ data: { deckId: deck.id, type: "content", orderIndex: 1, config: { title: "Một" } } });
  return deck;
}

describe("chia sẻ link xem bài giảng", () => {
  it("bật sinh mã 12 ký tự khó đoán; bật lại giữ nguyên mã", async () => {
    const owner = await makeUser("share-owner");
    const deck = await makeDeck(owner.id);

    const first = await setLiveDeckSharing(deck.id, owner.id, "enable", prisma);
    expect(first.shareCode).toMatch(/^[A-Za-z0-9_-]{12}$/);
    const again = await setLiveDeckSharing(deck.id, owner.id, "enable", prisma);
    expect(again.shareCode).toBe(first.shareCode);
  });

  it("tạo link mới làm link cũ hết hiệu lực ngay", async () => {
    const owner = await makeUser("share-rotate");
    const deck = await makeDeck(owner.id);
    const { shareCode: oldCode } = await setLiveDeckSharing(deck.id, owner.id, "enable", prisma);
    const { shareCode: newCode } = await setLiveDeckSharing(deck.id, owner.id, "rotate", prisma);

    expect(newCode).not.toBe(oldCode);
    expect(await getLiveDeckByShareCode(oldCode!, prisma)).toBeNull();
    expect((await getLiveDeckByShareCode(newCode!, prisma))?.id).toBe(deck.id);
  });

  it("tắt rồi bật lại ra mã mới, link cũ không sống lại", async () => {
    const owner = await makeUser("share-off");
    const deck = await makeDeck(owner.id);
    const { shareCode: oldCode } = await setLiveDeckSharing(deck.id, owner.id, "enable", prisma);

    expect((await setLiveDeckSharing(deck.id, owner.id, "disable", prisma)).shareCode).toBeNull();
    expect(await getLiveDeckByShareCode(oldCode!, prisma)).toBeNull();

    const { shareCode: again } = await setLiveDeckSharing(deck.id, owner.id, "enable", prisma);
    expect(again).not.toBe(oldCode);
  });

  it("người không phải chủ không bật/tắt được", async () => {
    const owner = await makeUser("share-owner2");
    const other = await makeUser("share-other");
    const deck = await makeDeck(owner.id);

    await expect(setLiveDeckSharing(deck.id, other.id, "enable", prisma)).rejects.toThrow(/Not authorized/);
    await expect(setLiveDeckSharing("00000000-0000-0000-0000-000000000000", owner.id, "enable", prisma)).rejects.toThrow(
      /Not authorized/
    );
  });

  it("đọc theo mã: slide đúng thứ tự, có tên chủ bài, không có dàn ý/tài liệu gốc/email", async () => {
    const owner = await makeUser("share-reader");
    const deck = await makeDeck(owner.id);
    const { shareCode } = await setLiveDeckSharing(deck.id, owner.id, "enable", prisma);

    const shared = await getLiveDeckByShareCode(shareCode!, prisma);
    expect(shared?.ownerName).toBe("share-reader");
    expect(shared?.slides.map((s) => (s.config as { title: string }).title)).toEqual(["Một", "Hai"]);
    const json = JSON.stringify(shared);
    expect(json).not.toContain("Tài liệu gốc bí mật");
    expect(json).not.toContain("@example.com");
    expect(shared).not.toHaveProperty("outline");
  });

  it("mã sai định dạng trả null mà không cần hỏi DB", async () => {
    expect(await getLiveDeckByShareCode("abc", prisma)).toBeNull();
    expect(await getLiveDeckByShareCode("../../etc/passwd", prisma)).toBeNull();
  });

  it("bản sao bài giảng không mang theo mã chia sẻ", async () => {
    const owner = await makeUser("share-dup");
    const deck = await makeDeck(owner.id);
    await setLiveDeckSharing(deck.id, owner.id, "enable", prisma);

    const copy = await duplicateLiveDeck(deck.id, owner.id, prisma);
    expect(copy.shareCode).toBeNull();
  });
});
