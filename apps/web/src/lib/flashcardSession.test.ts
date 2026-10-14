import { describe, expect, it, vi } from "vitest";
import {
  createReviewSubmitter,
  formatInterval,
  initSession,
  ratingForKey,
  sessionReducer,
  summarize,
} from "@/lib/flashcardSession";

/**
 * LANG G4 / G4.3.6 + G4.5 — điều khiển phiên ôn (lật → đánh giá → thẻ kế tiếp) và
 * hàng đợi gửi lượt ôn: thẻ kế tiếp hiện ngay, việc ghi nhận chạy nền và thử lại.
 */

const card = (n: number) => ({
  itemId: `item-${n}`,
  contentItemId: "ci",
  term: `từ${n}`,
  meaning: `nghĩa${n}`,
  isNew: true,
  intervals: { again: 1, hard: 1, good: 2, easy: 4 },
});

describe("sessionReducer", () => {
  it("bắt đầu ở thẻ đầu, chưa lật, đang chơi", () => {
    const s = initSession([card(1), card(2)]);
    expect(s).toMatchObject({ index: 0, flipped: false, status: "playing", results: [] });
  });

  it("flip lật thẻ; lật lần nữa không lật ngược lại (đánh giá mới là bước tiếp theo)", () => {
    let s = initSession([card(1)]);
    s = sessionReducer(s, { type: "flip" });
    expect(s.flipped).toBe(true);
    expect(sessionReducer(s, { type: "flip" }).flipped).toBe(true);
  });

  it("không đánh giá được khi chưa lật thẻ", () => {
    const s = initSession([card(1), card(2)]);
    expect(sessionReducer(s, { type: "rate", rating: "good" })).toBe(s);
  });

  it("đánh giá sau khi lật: ghi kết quả, sang thẻ kế và úp lại", () => {
    let s = initSession([card(1), card(2)]);
    s = sessionReducer(s, { type: "flip" });
    s = sessionReducer(s, { type: "rate", rating: "good" });
    expect(s).toMatchObject({ index: 1, flipped: false, status: "playing" });
    expect(s.results).toEqual([{ itemId: "item-1", rating: "good" }]);
  });

  it("thẻ cuối được đánh giá thì phiên kết thúc", () => {
    let s = initSession([card(1)]);
    s = sessionReducer(s, { type: "flip" });
    s = sessionReducer(s, { type: "rate", rating: "easy" });
    expect(s.status).toBe("done");
    // Sau khi xong, mọi thao tác đều vô hiệu.
    expect(sessionReducer(s, { type: "flip" })).toBe(s);
    expect(sessionReducer(s, { type: "rate", rating: "good" })).toBe(s);
  });

  it("phiên rỗng là xong ngay", () => {
    expect(initSession([]).status).toBe("done");
  });

  it("không sửa trạng thái cũ (bất biến)", () => {
    const s = initSession([card(1), card(2)]);
    const frozen = JSON.stringify(s);
    sessionReducer(sessionReducer(s, { type: "flip" }), { type: "rate", rating: "hard" });
    expect(JSON.stringify(s)).toBe(frozen);
  });
});

describe("summarize", () => {
  it("đếm theo mức và tổng", () => {
    expect(
      summarize([
        { itemId: "a", rating: "good" },
        { itemId: "b", rating: "again" },
        { itemId: "c", rating: "good" },
      ]),
    ).toEqual({ total: 3, again: 1, hard: 0, good: 2, easy: 0 });
  });
});

describe("ratingForKey — phím tắt G4.5.2", () => {
  it("1–4 ứng với Quên, Khó, Được, Dễ; phím khác là không", () => {
    expect(["1", "2", "3", "4"].map(ratingForKey)).toEqual(["again", "hard", "good", "easy"]);
    for (const k of ["0", "5", "a", " ", "Enter", ""]) expect(ratingForKey(k)).toBeNull();
  });
});

describe("formatInterval — nhãn khoảng ôn trên nút", () => {
  it("ngày → tuần → tháng → năm", () => {
    expect(formatInterval(1)).toBe("1 ngày");
    expect(formatInterval(2)).toBe("2 ngày");
    expect(formatInterval(6)).toBe("6 ngày");
    expect(formatInterval(7)).toBe("1 tuần");
    expect(formatInterval(14)).toBe("2 tuần");
    expect(formatInterval(30)).toBe("1 tháng");
    expect(formatInterval(90)).toBe("3 tháng");
    expect(formatInterval(365)).toBe("1 năm");
  });
});

describe("createReviewSubmitter — G4.3.6", () => {
  const ok = () => new Response(JSON.stringify({ duplicate: false }), { status: 200 });
  const input = (n: number) => ({ itemId: `i${n}`, rating: "good" as const, mode: "term_to_meaning" as const, reviewId: `r${n}` });
  const make = (fetchImpl: ReturnType<typeof vi.fn>, extra: Record<string, unknown> = {}) =>
    createReviewSubmitter({ courseId: "c1", fetchImpl: fetchImpl as unknown as typeof fetch, sleep: async () => {}, maxAttempts: 3, ...extra });

  it("enqueue không chặn: trả về ngay; flush chờ gửi xong; gửi đúng route và thân", async () => {
    const f = vi.fn().mockResolvedValue(ok());
    const s = make(f);
    s.enqueue(input(1));
    await s.flush();
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toContain("/api/courses/c1/flashcards/review");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual(input(1));
    expect(s.pending()).toBe(0);
  });

  it("giữ đúng thứ tự gửi", async () => {
    const order: string[] = [];
    const f = vi.fn().mockImplementation(async (_u: string, init: RequestInit) => {
      order.push(JSON.parse(String(init.body)).reviewId);
      return ok();
    });
    const s = make(f);
    [1, 2, 3].forEach((n) => s.enqueue(input(n)));
    await s.flush();
    expect(order).toEqual(["r1", "r2", "r3"]);
  });

  it("lỗi mạng hoặc 5xx: thử lại với CÙNG reviewId (nhờ đó server không tính hai lần)", async () => {
    const f = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response("boom", { status: 503 }))
      .mockResolvedValueOnce(ok());
    const s = make(f);
    s.enqueue(input(1));
    await s.flush();
    expect(f).toHaveBeenCalledTimes(3);
    const ids = f.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)).reviewId);
    expect(new Set(ids)).toEqual(new Set(["r1"]));
    expect(s.pending()).toBe(0);
  });

  it("lỗi 4xx (sai thẻ, hết quyền) không thử lại và được báo", async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "card_not_in_deck" }), { status: 404 }));
    const failed: unknown[] = [];
    const s = make(f, { onFailed: (x: unknown) => failed.push(x) });
    s.enqueue(input(1));
    await s.flush();
    expect(f).toHaveBeenCalledTimes(1);
    expect(failed).toHaveLength(1);
  });

  it("hết số lần thử thì báo thất bại và vẫn gửi tiếp các lượt sau", async () => {
    const f = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("x"))
      .mockRejectedValueOnce(new TypeError("x"))
      .mockRejectedValueOnce(new TypeError("x"))
      .mockResolvedValueOnce(ok());
    const failed: unknown[] = [];
    const s = make(f, { onFailed: (x: unknown) => failed.push(x) });
    s.enqueue(input(1));
    s.enqueue(input(2));
    await s.flush();
    expect(failed).toHaveLength(1);
    expect(f).toHaveBeenCalledTimes(4);
    expect(s.pending()).toBe(0);
  });
});
