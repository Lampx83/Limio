import { beforeEach, describe, expect, it, vi } from "vitest";

/** LANG G4 / G4.2 — GET /api/courses/:id/flashcards/queue?mode= */

const requireUserId = vi.fn();
const getFlashcardQueue = vi.fn();
vi.mock("@/lib/session", () => ({ requireUserId }));
vi.mock("@feedbackme/core-feedback", () => ({ getFlashcardQueue }));

const ME = "11111111-2222-4333-8444-555555555555";
const COURSE = "cccccccc-1111-4222-8333-444444444444";
const call = async (q = "") => {
  const { GET } = await import("./route");
  return GET(new Request(`http://x/api/courses/${COURSE}/flashcards/queue${q}`), { params: { id: COURSE } });
};

describe("GET /api/courses/[id]/flashcards/queue", () => {
  beforeEach(() => {
    requireUserId.mockReset().mockResolvedValue(ME);
    getFlashcardQueue.mockReset().mockResolvedValue({ cards: [], dueCount: 0, newCount: 0 });
  });

  it("chưa đăng nhập → 401, không đọc dữ liệu", async () => {
    requireUserId.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(getFlashcardQueue).not.toHaveBeenCalled();
  });

  it("luôn lấy phiên của CHÍNH người đang đăng nhập (không có tham số userId)", async () => {
    await call(`?userId=aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee&mode=term_to_meaning`);
    expect(getFlashcardQueue).toHaveBeenCalledWith(ME, COURSE, { mode: "term_to_meaning" });
  });

  it("mặc định Hán→nghĩa; ba chế độ hợp lệ được chuyển xuống; chế độ lạ → 400", async () => {
    await call();
    expect(getFlashcardQueue).toHaveBeenLastCalledWith(ME, COURSE, { mode: "term_to_meaning" });
    for (const mode of ["term_to_meaning", "meaning_to_term", "audio_to_term"]) {
      await call(`?mode=${mode}`);
      expect(getFlashcardQueue).toHaveBeenLastCalledWith(ME, COURSE, { mode });
    }
    getFlashcardQueue.mockClear();
    expect((await call("?mode=hanzi")).status).toBe(400);
    expect(getFlashcardQueue).not.toHaveBeenCalled();
  });

  it("chưa ghi danh → 403", async () => {
    getFlashcardQueue.mockResolvedValue({ cards: [], reason: "not_enrolled", dueCount: 0, newCount: 0 });
    expect((await call()).status).toBe(403);
  });

  it("dữ liệu cá nhân: không cache", async () => {
    const res = await call();
    expect(res.headers.get("cache-control")).toMatch(/private/);
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
  });

  it("phản hồi đi nguyên hình dạng phiên ôn", async () => {
    const q = { cards: [{ itemId: "i", term: "a", meaning: "b", isNew: true }], dueCount: 0, newCount: 1 };
    getFlashcardQueue.mockResolvedValue(q);
    expect(await (await call()).json()).toEqual(q);
  });
});
