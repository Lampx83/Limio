import { describe, expect, it } from "vitest";
import { gradeExamAnswer } from "../grading";
import { toPublicQuestionConfig } from "../public-config";
import { publicToken, resolvePublicId, seededShuffle } from "../public-tokens";

// docs/tieu-chi/exam-loai-cau-va-dan-anh-doan-van.md — mục C: Sắp xếp, Ghép cặp, Kéo thả điền, Số xuống trình duyệt mà không lộ đáp án.

const ORDERING = {
  items: ["oi-secret-1", "oi-secret-2", "oi-secret-3", "oi-secret-4", "oi-secret-5", "oi-secret-6"].map((id, i) => ({ id, label: `Bước ${i + 1}` })),
  explanation: "giải thích bí mật",
};
const MATCHING = {
  pairs: ["mp-secret-1", "mp-secret-2", "mp-secret-3", "mp-secret-4"].map((id, i) => ({ id, left: `Trái ${i + 1}`, right: `Phải ${i + 1}` })),
  explanation: "giải thích bí mật",
};
const DRAGDROP = {
  tokens: [
    { id: "dt-secret-1", label: "went", blankIndex: 1 },
    { id: "dt-secret-2", label: "have", blankIndex: 2 },
    { id: "dt-secret-3", label: "been", blankIndex: 3 },
    { id: "dt-secret-4", label: "mồi nhử", blankIndex: null },
  ],
  explanation: "giải thích bí mật",
};

describe("publicToken / resolvePublicId", () => {
  it("mã công khai ổn định, khác nhau theo phần tử, không chứa mã gốc", () => {
    expect(publicToken("a")).toBe(publicToken("a"));
    expect(publicToken("a")).not.toBe(publicToken("b"));
    expect(publicToken("oi-secret-1")).not.toContain("secret");
  });

  it("đổi về mã gốc: nhận mã công khai và mã gốc cũ; không khớp / không phải chuỗi thì null", () => {
    const ids = ["x1", "x2", "x3"];
    expect(resolvePublicId(ids, publicToken("x2"))).toBe("x2");
    expect(resolvePublicId(ids, "x3")).toBe("x3");
    expect(resolvePublicId(ids, "lạ")).toBeNull();
    expect(resolvePublicId(ids, publicToken("không-có"))).toBeNull();
    expect(resolvePublicId(ids, 5)).toBeNull();
    expect(resolvePublicId(ids, null)).toBeNull();
  });
});

describe("seededShuffle", () => {
  const base = ["a", "b", "c", "d", "e", "f"];
  it("cùng hạt giống cùng thứ tự (tải lại trang không đổi); khác hạt thì có lúc khác", () => {
    expect(seededShuffle(base, "s1")).toEqual(seededShuffle(base, "s1"));
    const seen = new Set(Array.from({ length: 20 }, (_, i) => seededShuffle(base, `seed-${i}`).join("")));
    expect(seen.size).toBeGreaterThan(5);
  });
  it("giữ đủ phần tử; không bao giờ trùng thứ tự cần tránh (kể cả khi xáo ra đúng thứ tự đó)", () => {
    for (let i = 0; i < 200; i++) {
      const r = seededShuffle(base, `k${i}`, (x) => x.join("") === base.join(""));
      expect([...r].sort()).toEqual(base);
      expect(r.join("")).not.toBe(base.join(""));
    }
    expect(seededShuffle(["a", "b"], "x", () => true)).toEqual(["b", "a"]);
    expect(seededShuffle(["a"], "x", () => true)).toEqual(["a"]);
  });
});

describe("toPublicQuestionConfig — Sắp xếp / Ghép cặp / Kéo thả / Số", () => {
  it("ordering: mã công khai, danh sách đã xáo (khác thứ tự đúng), không lộ mã gốc và lời giải", () => {
    const out = toPublicQuestionConfig("ordering", ORDERING, "lượt-1:q1") as { items: Array<{ id: string; label: string }> };
    const json = JSON.stringify(out);
    expect(json).not.toContain("secret");
    expect(out.items).toHaveLength(6);
    expect(out.items.map((i) => i.label).join()).not.toBe(ORDERING.items.map((i) => i.label).join());
    expect(out.items.map((i) => i.id).sort()).toEqual(ORDERING.items.map((i) => publicToken(i.id)).sort());
    // cùng hạt → cùng thứ tự
    expect(toPublicQuestionConfig("ordering", ORDERING, "lượt-1:q1")).toEqual(out);
  });

  it("matching: vế trái giữ mã cặp, vế phải đổi mã công khai (không có mã cặp nào ở vế phải) và xáo", () => {
    const out = toPublicQuestionConfig("matching", MATCHING, "lượt-1:q2") as {
      lefts: Array<{ id: string; label: string }>;
      rights: Array<{ id: string; label: string }>;
    };
    expect(out.lefts.map((l) => l.id)).toEqual(MATCHING.pairs.map((p) => p.id));
    for (const r of out.rights) expect(MATCHING.pairs.map((p) => p.id)).not.toContain(r.id);
    expect(out.rights.map((r) => r.label).join()).not.toBe(MATCHING.pairs.map((p) => p.right).join());
    expect(JSON.stringify(out.rights)).not.toContain("secret");
    expect(JSON.stringify(out)).not.toContain("giải thích");
  });

  it("drag_drop_fill: token (kèm mồi nhử) đã xáo, mã công khai, KHÔNG có blankIndex", () => {
    const out = toPublicQuestionConfig("drag_drop_fill", DRAGDROP, "lượt-1:q3") as { tokens: Array<Record<string, unknown>> };
    expect(out.tokens).toHaveLength(4);
    for (const t of out.tokens) expect(Object.keys(t).sort()).toEqual(["id", "label"]);
    expect(JSON.stringify(out)).not.toContain("blankIndex");
    expect(JSON.stringify(out)).not.toContain("secret");
  });

  it("numerical: không gửi expected/tolerance", () => {
    expect(toPublicQuestionConfig("numerical", { expected: 42, tolerance: 1, explanation: "x" })).toEqual({});
  });

  it("dữ liệu hỏng không làm sập: trả danh sách rỗng", () => {
    expect(toPublicQuestionConfig("ordering", null)).toEqual({ items: [] });
    expect(toPublicQuestionConfig("matching", { pairs: "oops" })).toEqual({ lefts: [], rights: [] });
    expect(toPublicQuestionConfig("drag_drop_fill", undefined)).toEqual({ tokens: [] });
  });
});

describe("chấm điểm bằng mã công khai (đúng cái trình duyệt gửi lên)", () => {
  it("ordering: thứ tự đúng theo mã công khai được điểm; sai thứ tự / thiếu / mã lạ thì 0; mã gốc cũ vẫn nhận", () => {
    const ids = ORDERING.items.map((i) => i.id);
    const tok = (xs: string[]) => xs.map(publicToken);
    expect(gradeExamAnswer("ordering", ORDERING, { order: tok(ids) }, 6)).toEqual({ autoScore: 6, needsGrading: false });
    expect(gradeExamAnswer("ordering", ORDERING, { order: tok([...ids].reverse()) }, 6).autoScore).toBe(0);
    expect(gradeExamAnswer("ordering", ORDERING, { order: tok(ids.slice(0, 5)) }, 6).autoScore).toBe(0);
    expect(gradeExamAnswer("ordering", ORDERING, { order: [...tok(ids.slice(0, 5)), "lạ"] }, 6).autoScore).toBe(0);
    expect(gradeExamAnswer("ordering", ORDERING, { order: ids }, 6).autoScore).toBe(6);
  });

  it("matching: ghép đúng theo mã công khai của vế phải được điểm; ghép chéo / thiếu thì 0", () => {
    const ids = MATCHING.pairs.map((p) => p.id);
    const right = (id: string) => publicToken(id);
    const good = Object.fromEntries(ids.map((id) => [id, right(id)]));
    expect(gradeExamAnswer("matching", MATCHING, { matched: good }, 4).autoScore).toBe(4);
    const swapped = { ...good, [ids[0]!]: right(ids[1]!), [ids[1]!]: right(ids[0]!) };
    expect(gradeExamAnswer("matching", MATCHING, { matched: swapped }, 4).autoScore).toBe(0);
    expect(gradeExamAnswer("matching", MATCHING, { matched: { [ids[0]!]: right(ids[0]!) } }, 4).autoScore).toBe(0);
    expect(gradeExamAnswer("matching", MATCHING, { matched: Object.fromEntries(ids.map((id) => [id, id])) }, 4).autoScore).toBe(4);
  });

  it("drag_drop_fill: đặt đúng token (mã công khai) vào mọi ô thật được điểm; mồi nhử hoặc sai ô thì 0", () => {
    const good = { placed: { "1": publicToken("dt-secret-1"), "2": publicToken("dt-secret-2"), "3": publicToken("dt-secret-3") } };
    expect(gradeExamAnswer("drag_drop_fill", DRAGDROP, good, 3).autoScore).toBe(3);
    expect(gradeExamAnswer("drag_drop_fill", DRAGDROP, { placed: { ...good.placed, "3": publicToken("dt-secret-4") } }, 3).autoScore).toBe(0);
    expect(gradeExamAnswer("drag_drop_fill", DRAGDROP, { placed: { ...good.placed, "1": publicToken("dt-secret-2"), "2": publicToken("dt-secret-1") } }, 3).autoScore).toBe(0);
  });
});
