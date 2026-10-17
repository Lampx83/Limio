import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../auth/register";
import { createLiveDeck, duplicateLiveDeck, getLiveDeck, updateLiveDeck } from "../live/decks";

const BASE = "http://localhost:3000";
const BRAND = { logoUrl: "/api/limio-live-media/x-logo.png", logoPos: "bl", logoSize: "l", logoShow: "ends", colors: { primary: "#0A6EBD", secondary: "#0E7490", accent: "#F59E0B" } };

async function owner(tag: string) {
  const r = await registerUser({ email: `brand-${tag}-${Date.now()}@e.com`, password: "password1234", displayName: tag }, BASE);
  return r.userId;
}

describe("thương hiệu của bài giảng Limio-Live", () => {
  it("bài mới chưa có thương hiệu; đặt rồi đọc lại đúng; null thì xoá", async () => {
    const userId = await owner("set");
    const deck = await createLiveDeck({ userId, title: "Bài có thương hiệu" }, prisma);
    expect(deck.brand).toBeNull();

    await updateLiveDeck(deck.id, userId, { brand: BRAND }, prisma);
    expect((await getLiveDeck(deck.id, userId, prisma))!.brand).toEqual(BRAND);

    // sửa tiêu đề không đụng tới thương hiệu
    await updateLiveDeck(deck.id, userId, { title: "Đổi tên" }, prisma);
    expect((await getLiveDeck(deck.id, userId, prisma))!.brand).toEqual(BRAND);

    await updateLiveDeck(deck.id, userId, { brand: null }, prisma);
    expect((await getLiveDeck(deck.id, userId, prisma))!.brand).toBeNull();
  });

  it("chỉ chủ bài giảng mới đặt được thương hiệu", async () => {
    const a = await owner("a");
    const b = await owner("b");
    const deck = await createLiveDeck({ userId: a, title: "Của A" }, prisma);
    await expect(updateLiveDeck(deck.id, b, { brand: BRAND }, prisma)).rejects.toThrow(/Not authorized/);
    expect((await getLiveDeck(deck.id, a, prisma))!.brand).toBeNull();
  });

  it("nhân bản bài giảng mang theo thương hiệu; bài không có thì bản sao cũng không có", async () => {
    const userId = await owner("dup");
    const withBrand = await createLiveDeck({ userId, title: "Có" }, prisma);
    await updateLiveDeck(withBrand.id, userId, { brand: BRAND }, prisma);
    const copy = await duplicateLiveDeck(withBrand.id, userId, prisma);
    expect(copy.brand).toEqual(BRAND);

    const plain = await createLiveDeck({ userId, title: "Không" }, prisma);
    expect((await duplicateLiveDeck(plain.id, userId, prisma)).brand).toBeNull();
  });
});
