import { beforeEach, describe, expect, it, vi } from "vitest";

/** LANG G4 / G4.3 — POST /api/courses/:id/flashcards/review */

const requireUserId = vi.fn();
const reviewFlashcard = vi.fn();
vi.mock("@/lib/session", () => ({ requireUserId }));
vi.mock("@feedbackme/core-feedback", () => {
  class FlashcardError extends Error {
    constructor(public code: string) {
      super(code);
      this.name = "FlashcardError";
    }
  }
  return { reviewFlashcard, FlashcardError };
});

const ME = "11111111-2222-4333-8444-555555555555";
const COURSE = "cccccccc-1111-4222-8333-444444444444";
const body = { itemId: "dddddddd-1111-4222-8333-444444444444", rating: "good", mode: "term_to_meaning", reviewId: "eeeeeeee-1111-4222-8333-444444444444" };
const post = async (b: unknown, raw?: string) => {
  const { POST } = await import("./route");
  return POST(
    new Request(`http://x/api/courses/${COURSE}/flashcards/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw ?? JSON.stringify(b),
    }),
    { params: { id: COURSE } },
  );
};

describe("POST /api/courses/[id]/flashcards/review", () => {
  beforeEach(() => {
    requireUserId.mockReset().mockResolvedValue(ME);
    reviewFlashcard.mockReset().mockResolvedValue({ duplicate: false, state: { intervalDays: 2 } });
  });

  it("chưa đăng nhập → 401, không ghi gì", async () => {
    requireUserId.mockResolvedValue(null);
    expect((await post(body)).status).toBe(401);
    expect(reviewFlashcard).not.toHaveBeenCalled();
  });

  it("ghi lượt ôn cho CHÍNH người đăng nhập, không bao giờ cho userId trong thân yêu cầu", async () => {
    const res = await post({ ...body, userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" });
    expect(res.status).toBe(200);
    expect(reviewFlashcard).toHaveBeenCalledTimes(1);
    expect(reviewFlashcard.mock.calls[0]![0]).toBe(ME);
    expect(reviewFlashcard.mock.calls[0]![1]).toBe(COURSE);
    expect(reviewFlashcard.mock.calls[0]![2]).toEqual(body); // userId lạ không lọt xuống
  });

  it("thân yêu cầu không phải JSON → 400", async () => {
    expect((await post(null, "{không phải json")).status).toBe(400);
    expect(reviewFlashcard).not.toHaveBeenCalled();
  });

  it("ánh xạ lỗi: validation_failed → 400, not_enrolled → 403, card_not_in_deck → 404", async () => {
    const { FlashcardError } = await import("@feedbackme/core-feedback");
    for (const [code, status] of [["validation_failed", 400], ["not_enrolled", 403], ["card_not_in_deck", 404]] as const) {
      reviewFlashcard.mockRejectedValueOnce(new FlashcardError(code as never));
      const res = await post(body);
      expect(res.status).toBe(status);
      expect((await res.json()).error).toBe(code);
    }
  });

  it("gửi lại cùng lượt (duplicate) vẫn là 200 để máy khách ngừng thử lại", async () => {
    reviewFlashcard.mockResolvedValue({ duplicate: true, state: { intervalDays: 2 } });
    const res = await post(body);
    expect(res.status).toBe(200);
    expect((await res.json()).duplicate).toBe(true);
  });

  it("lỗi không lường trước không rò chi tiết nội bộ", async () => {
    reviewFlashcard.mockRejectedValueOnce(new Error("connection string postgres://secret"));
    const res = await post(body);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });

  it("không cache", async () => {
    expect((await post(body)).headers.get("cache-control")).toMatch(/no-store/);
  });
});
