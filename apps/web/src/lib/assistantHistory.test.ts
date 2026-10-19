import { describe, expect, it } from "vitest";
import {
  MAX_STORED_MESSAGES,
  isInternalHref,
  loadHistory,
  sanitizeStoredMessages,
  saveHistory,
  storageKey,
  type StoredMessage,
} from "./assistantHistory";

const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  };
};

describe("isInternalHref", () => {
  it("chỉ nhận đường dẫn nội bộ", () => {
    expect(isInternalHref("/instructor/exams")).toBe(true);
    expect(isInternalHref("/instructor/teaching-tools?tool=poll")).toBe(true);
    for (const bad of ["//evil.com", "https://evil.com", "javascript:alert(1)", "instructor/exams", "/a b", ""]) expect(isInternalHref(bad), bad).toBe(false);
  });
});

describe("sanitizeStoredMessages", () => {
  it("giữ tin hợp lệ, bỏ cờ fresh", () => {
    const out = sanitizeStoredMessages([
      { role: "user", text: "Xin chào" },
      { role: "assistant", text: "Chào thầy/cô", actions: [{ id: "poll", label: "Bình chọn nhanh", href: "/instructor/teaching-tools?tool=poll", icon: "poll" }], followUps: ["Hỏi tiếp"], fresh: true },
    ]);
    expect(out).toHaveLength(2);
    expect(out[1]).toEqual({ role: "assistant", text: "Chào thầy/cô", actions: [{ id: "poll", label: "Bình chọn nhanh", href: "/instructor/teaching-tools?tool=poll", icon: "poll" }], followUps: ["Hỏi tiếp"] });
    expect("fresh" in out[1]!).toBe(false);
  });

  it("dữ liệu bị sửa/hỏng thì bỏ chứ không ném lỗi", () => {
    for (const bad of [null, undefined, "x", 3, {}, [null, 1, "a", { role: "system", text: "x" }, { role: "user" }, { role: "user", text: "   " }]]) {
      expect(sanitizeStoredMessages(bad)).toEqual([]);
    }
  });

  it("bỏ liên kết ra ngoài hoặc kiểu javascript:, chỉ giữ liên kết nội bộ, tối đa 3", () => {
    const [m] = sanitizeStoredMessages([
      {
        role: "assistant",
        text: "ok",
        actions: [
          { id: "a", label: "Ngoài", href: "https://evil.com", icon: "x" },
          { id: "b", label: "Giả", href: "javascript:alert(1)", icon: "x" },
          { id: "c", label: "Cùng origin lạ", href: "//evil.com/x", icon: "x" },
          ...["d", "e", "f", "g"].map((id) => ({ id, label: id, href: `/instructor/${id}`, icon: "course" })),
        ],
        followUps: [],
      },
    ]) as Extract<StoredMessage, { role: "assistant" }>[];
    expect(m!.actions.map((a) => a.id)).toEqual(["d", "e", "f"]);
  });

  it("giới hạn số tin giữ lại và độ dài", () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ role: "user", text: `tin ${i}` }));
    const out = sanitizeStoredMessages(many);
    expect(out).toHaveLength(MAX_STORED_MESSAGES);
    expect((out[out.length - 1] as { text: string }).text).toBe("tin 79");
    const long = sanitizeStoredMessages([{ role: "user", text: "x".repeat(10_000) }]);
    expect((long[0] as { text: string }).text.length).toBeLessThanOrEqual(2600);
  });
});

describe("loadHistory / saveHistory (sessionStorage)", () => {
  it("ghi rồi đọc lại đúng, tách theo tài khoản", () => {
    const st = memory();
    const msgs: StoredMessage[] = [{ role: "user", text: "Cách tạo đề thi" }, { role: "assistant", text: "Vào Thiết kế đề thi.", actions: [], followUps: [] }];
    saveHistory(st, "u1", msgs);
    expect(loadHistory(st, "u1")).toEqual(msgs);
    expect(loadHistory(st, "u2")).toEqual([]);
    expect([...st.raw.keys()]).toEqual([storageKey("u1")]);
  });

  it("lịch sử rỗng thì xoá khoá; JSON hỏng thì trả rỗng", () => {
    const st = memory();
    saveHistory(st, "u1", [{ role: "user", text: "a" }]);
    saveHistory(st, "u1", []);
    expect(st.raw.size).toBe(0);
    st.setItem(storageKey("u1"), "{không phải json");
    expect(loadHistory(st, "u1")).toEqual([]);
  });

  it("storage lỗi (chế độ riêng tư, đầy dung lượng) thì im lặng", () => {
    const boom = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(loadHistory(boom, "u1")).toEqual([]);
    expect(() => saveHistory(boom, "u1", [{ role: "user", text: "a" }])).not.toThrow();
    expect(loadHistory(null, "u1")).toEqual([]);
    expect(() => saveHistory(undefined, "u1", [])).not.toThrow();
  });
});
