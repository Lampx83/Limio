import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { registerUser } from "../../auth/register";
import { addLiveSlide, deleteLiveDeck, duplicateLiveDeck, getLiveDeck, reorderLiveSlides, updateLiveDeck, updateLiveSlide, createLiveDeck } from "../decks";
import { addDeckCollaborator, DeckCollaboratorError, listDeckPeople, listDecksSharedWithMe, removeDeckCollaborator } from "../deckCollaborators";
import { deckAccessWhere, hasDeckAccess } from "../deckAccess";
import { startOrResumeLiveSession } from "../present";
import { listLiveSessionHistory } from "../history";
import { setLiveDeckSharing } from "../share";
import { createLiveDeckGroup, setLiveDeckGroup } from "../groups";
import { listSlideVersions } from "../slideVersions";

const BASE = "http://localhost:3000";

/** Cờ dùng Limio-Live (ở môi trường thật do seed tạo). Tạo ngay trước mỗi bài thử: bộ dọn dữ liệu của test khác trong cùng DB có thể xoá nó. */
async function ensureFlag() {
  await prisma.featureFlag.upsert({
    where: { key: "limio_live.access" },
    update: { defaultValue: true },
    create: { key: "limio_live.access", group: "limio_live", name: "Dùng Limio-Live", description: "test", valueType: "boolean", defaultValue: true },
  });
}

async function setup(tag: string) {
  await ensureFlag();
  const owner = await registerUser({ email: `o-${tag}@e.com`, password: "password1234", displayName: "Chủ bài" }, BASE);
  const co = await registerUser({ email: `c-${tag}@e.com`, password: "password1234", displayName: "Đồng giảng viên" }, BASE);
  const out = await registerUser({ email: `x-${tag}@e.com`, password: "password1234", displayName: "Người ngoài" }, BASE);
  const deck = await createLiveDeck({ userId: owner.userId, title: "Bài giảng" }, prisma);
  const slide = await addLiveSlide(deck.id, owner.userId, { type: "content", config: { title: "S1" } }, prisma);
  return { ownerId: owner.userId, coId: co.userId, outId: out.userId, deckId: deck.id, slideId: slide.id, coEmail: `c-${tag}@e.com` };
}

const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof DeckCollaboratorError ? e.code : e instanceof Error ? e.message : String(e)));

describe("đồng giảng viên của bài giảng Limio-Live", () => {
  it("chủ thêm bằng email (không phân biệt hoa thường), thêm lại không đổi gì, ghi sự kiện, và danh sách hiện đúng", async () => {
    const t = await setup("dc-add");
    const r = await addDeckCollaborator(t.ownerId, t.deckId, ` ${t.coEmail.toUpperCase()} `, prisma);
    expect(r.added).toBe(true);
    expect(r.person).toMatchObject({ userId: t.coId, displayName: "Đồng giảng viên" });
    expect((await addDeckCollaborator(t.ownerId, t.deckId, t.coEmail, prisma)).added).toBe(false);

    const events = await prisma.learningEvent.findMany({ where: { userId: t.ownerId, eventType: LearningEventType.LiveDeckCollaboratorAdded } });
    expect(events).toHaveLength(1);
    expect(events[0]!.payload).toMatchObject({ deckId: t.deckId, collaboratorId: t.coId });

    const people = await listDeckPeople(t.deckId, t.coId, prisma);
    expect(people.role).toBe("collaborator");
    expect(people.selfId).toBe(t.coId);
    expect(people.owner.displayName).toBe("Chủ bài");
    expect(people.collaborators.map((c) => c.userId)).toEqual([t.coId]);
    expect((await listDeckPeople(t.deckId, t.ownerId, prisma)).role).toBe("owner");
    expect(await code(listDeckPeople(t.deckId, t.outId, prisma))).toBe("forbidden");
  });

  it("chỉ chủ thêm được; email sai, chưa có tài khoản, chính chủ, hoặc không có quyền Limio-Live đều bị từ chối", async () => {
    const t = await setup("dc-bad");
    expect(await code(addDeckCollaborator(t.coId, t.deckId, t.outId + "@x.com", prisma))).toBe("forbidden");
    expect(await code(addDeckCollaborator(t.ownerId, t.deckId, "không-phải-email", prisma))).toBe("invalid_email");
    expect(await code(addDeckCollaborator(t.ownerId, t.deckId, "chua-co@e.com", prisma))).toBe("user_not_found");
    expect(await code(addDeckCollaborator(t.ownerId, t.deckId, "o-dc-bad@e.com", prisma))).toBe("already_owner");
    expect(await code(addDeckCollaborator(t.ownerId, "00000000-0000-0000-0000-000000000000", t.coEmail, prisma))).toBe("not_found");

    // Khoá riêng tài khoản này khỏi Limio-Live (override theo người dùng).
    await prisma.userFeatureOverride.create({ data: { userId: t.coId, featureKey: "limio_live.access", value: false, reason: "test", grantedBy: t.ownerId } });
    expect(await code(addDeckCollaborator(t.ownerId, t.deckId, t.coEmail, prisma))).toBe("no_limio_live_access");
  });

  it("đồng giảng viên soạn, chiếu, nhân bản, xem lịch sử; không xoá, chia sẻ, đổi nhóm; người ngoài không làm được gì", async () => {
    const t = await setup("dc-perm");
    await addDeckCollaborator(t.ownerId, t.deckId, t.coEmail, prisma);

    // Được:
    expect(await hasDeckAccess({ id: t.deckId, userId: t.ownerId }, t.coId, prisma)).toBe(true);
    expect((await getLiveDeck(t.deckId, t.coId, prisma))?.slides).toHaveLength(1);
    expect((await updateLiveDeck(t.deckId, t.coId, { title: "Đã đổi tên" }, prisma)).title).toBe("Đã đổi tên");
    const s2 = await addLiveSlide(t.deckId, t.coId, { type: "content", config: { title: "S2" } }, prisma);
    await updateLiveSlide(s2.id, t.coId, { config: { title: "S2 sửa" } }, prisma);
    await reorderLiveSlides(t.deckId, t.coId, [s2.id, t.slideId], prisma);
    expect(await listSlideVersions(prisma, s2.id, t.coId)).toBeDefined();
    const session = await startOrResumeLiveSession(t.deckId, t.coId, prisma);
    expect(session.userId).toBe(t.coId); // phiên là của người chiếu
    expect((await listLiveSessionHistory(t.deckId, t.coId, prisma)).map((s) => s.id)).toEqual([session.id]);
    expect((await listLiveSessionHistory(t.deckId, t.ownerId, prisma))).toEqual([]); // mỗi người thấy phiên của chính mình
    const copy = await duplicateLiveDeck(t.deckId, t.coId, prisma);
    expect(copy.userId).toBe(t.coId);
    expect(copy.groupId).toBeNull();

    // Không:
    await expect(deleteLiveDeck(t.deckId, t.coId, prisma)).rejects.toThrow();
    await expect(setLiveDeckSharing(t.deckId, t.coId, "enable", prisma)).rejects.toThrow();
    const group = await createLiveDeckGroup(t.coId, { name: "Nhóm của tôi", kind: "other" }, prisma);
    await expect(setLiveDeckGroup(t.deckId, t.coId, group.id, prisma)).rejects.toThrow();

    // Người ngoài: không gì cả.
    expect(await getLiveDeck(t.deckId, t.outId, prisma)).toBeNull();
    await expect(updateLiveDeck(t.deckId, t.outId, { title: "x" }, prisma)).rejects.toThrow();
    await expect(addLiveSlide(t.deckId, t.outId, { type: "content", config: {} }, prisma)).rejects.toThrow();
    await expect(startOrResumeLiveSession(t.deckId, t.outId, prisma)).rejects.toThrow();
    await expect(duplicateLiveDeck(t.deckId, t.outId, prisma)).rejects.toThrow();
    expect(await prisma.liveDeck.count({ where: { id: t.deckId, ...deckAccessWhere(t.outId) } })).toBe(0);

    // Chủ vẫn xoá được.
    await deleteLiveDeck(t.deckId, t.ownerId, prisma);
  });

  it("chủ gỡ bất kỳ ai, đồng giảng viên tự rời nhưng không gỡ người khác; gỡ xong mất quyền; xoá bài thì dọn hàng liên kết", async () => {
    const t = await setup("dc-rm");
    const co2 = await registerUser({ email: "c2-dc-rm@e.com", password: "password1234", displayName: "Người thứ hai" }, BASE);
    await addDeckCollaborator(t.ownerId, t.deckId, t.coEmail, prisma);
    await addDeckCollaborator(t.ownerId, t.deckId, "c2-dc-rm@e.com", prisma);
    expect((await listDecksSharedWithMe(t.coId, prisma)).map((d) => d.id)).toEqual([t.deckId]);
    expect((await listDecksSharedWithMe(t.coId, prisma))[0]).toMatchObject({ ownerName: "Chủ bài", slideCount: 1 });
    expect(await listDecksSharedWithMe(t.outId, prisma)).toEqual([]);

    expect(await code(removeDeckCollaborator(t.coId, t.deckId, co2.userId, prisma))).toBe("forbidden"); // không gỡ người khác
    await removeDeckCollaborator(t.coId, t.deckId, t.coId, prisma); // tự rời
    expect(await getLiveDeck(t.deckId, t.coId, prisma)).toBeNull();
    await removeDeckCollaborator(t.ownerId, t.deckId, co2.userId, prisma); // chủ gỡ
    await removeDeckCollaborator(t.ownerId, t.deckId, co2.userId, prisma); // gỡ lại: không lỗi
    const removed = await prisma.learningEvent.findMany({ where: { eventType: LearningEventType.LiveDeckCollaboratorRemoved, payload: { path: ["deckId"], equals: t.deckId } } });
    expect(removed.map((e) => (e.payload as { left: boolean }).left).sort()).toEqual([false, true]);

    await addDeckCollaborator(t.ownerId, t.deckId, t.coEmail, prisma);
    await deleteLiveDeck(t.deckId, t.ownerId, prisma);
    expect(await prisma.liveDeckCollaborator.count({ where: { deckId: t.deckId } })).toBe(0);
  });
});
