import { describe, expect, it, vi } from "vitest";
import {
  aiItemToEditorItem,
  aiVocabErrorMessage,
  filledLabel,
  extractVocabWithAi,
  selectedItems,
  toggleSelection,
  selectAll,
  type AiVocabItem,
} from "@/lib/aiVocabImport";

/**
 * LANG G2.5 / G2.5.4 — phần logic thuần của giao diện nhập từ vựng bằng AI:
 * gọi API, chọn dòng ở bản xem trước, chuyển dòng AI thành dòng của bộ soạn,
 * và lời lẽ báo lỗi.
 */

const item = (over: Partial<AiVocabItem> = {}): AiVocabItem => ({ term: "你好", meaning: "xin chào", filled: [], ...over });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("extractVocabWithAi", () => {
  it("thành công: gửi rawText và fillMissing đến /api/ai/extract-vocab, trả items + skipped", async () => {
    const f = vi.fn().mockResolvedValue(json({ items: [item()], skipped: [{ reason: "Thiếu nghĩa" }] }));
    const r = await extractVocabWithAi("你好 xin chào", true, f as unknown as typeof fetch);
    expect(r).toEqual({ ok: true, items: [item()], skipped: [{ reason: "Thiếu nghĩa" }] });
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toContain("/api/ai/extract-vocab");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ rawText: "你好 xin chào", fillMissing: true });
  });

  it("lỗi từ máy chủ: trả mã lỗi, status và lời tiếng Việt", async () => {
    const f = vi.fn().mockResolvedValue(json({ error: "openai_not_configured" }, 503));
    const r = await extractVocabWithAi("x".repeat(30), false, f as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: false, error: "openai_not_configured", status: 503 });
    expect((r as { message: string }).message).toMatch(/OpenAI/);
  });

  it("mất mạng và phản hồi không phải JSON đều cho kết quả có cấu trúc, không ném lỗi", async () => {
    const down = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await extractVocabWithAi("x".repeat(30), false, down as unknown as typeof fetch)).toMatchObject({ ok: false, error: "network_error" });
    const html = vi.fn().mockResolvedValue(new Response("<html>502</html>", { status: 502 }));
    expect(await extractVocabWithAi("x".repeat(30), false, html as unknown as typeof fetch)).toMatchObject({ ok: false, status: 502 });
  });

  it("phản hồi thành công nhưng sai hình dạng không làm sập giao diện", async () => {
    const f = vi.fn().mockResolvedValue(json({ items: "sai" }));
    expect(await extractVocabWithAi("x".repeat(30), false, f as unknown as typeof fetch)).toEqual({ ok: true, items: [], skipped: [] });
  });
});

describe("aiVocabErrorMessage — G2.5.4.4", () => {
  it("lời tiếng Việt cho từng mã, không lộ chi tiết kỹ thuật", () => {
    const cases: Array<[string, number | undefined, unknown, RegExp]> = [
      ["openai_not_configured", 503, undefined, /OpenAI/],
      ["no_token_budget", 429, undefined, /ví|hạn mức/i],
      ["daily_token_cap", 429, undefined, /hôm nay|hạn mức/i],
      ["global_token_cap", 429, undefined, /hệ thống|hôm nay/i],
      ["rate_limited", 429, undefined, /thử lại|chậm/i],
      ["validation_failed", 400, "too_short", /ngắn/],
      ["validation_failed", 400, "too_long", /dài/],
      ["validation_failed", 400, "empty_content", /dán/i],
      ["json_parse_failed", 400, undefined, /đọc|chia nhỏ/i],
      ["openai_error", 400, undefined, /AI|thử lại/i],
      ["forbidden", 403, undefined, /quyền/i],
      ["unauthorized", 401, undefined, /đăng nhập/i],
      ["network_error", undefined, undefined, /mạng/i],
    ];
    for (const [code, status, details, re] of cases) {
      const m = aiVocabErrorMessage(code, status, details);
      expect(m, `${code}/${String(details)}`).toMatch(re);
      expect(m).not.toMatch(/Error:|undefined|stack|at \w+\.|sk-/);
    }
  });

  it("mã lạ vẫn có lời chung chấp nhận được", () => {
    expect(aiVocabErrorMessage("lạ_hoắc", 500).length).toBeGreaterThan(10);
  });
});

describe("chọn dòng ở bản xem trước", () => {
  const items = [item({ term: "a" }), item({ term: "b" }), item({ term: "c" })];

  it("mặc định chọn hết; bỏ/chọn từng dòng; chọn lại tất cả", () => {
    let sel = selectAll(items);
    expect([...sel].sort()).toEqual([0, 1, 2]);
    sel = toggleSelection(sel, 1);
    expect(selectedItems(items, sel).map((i) => i.term)).toEqual(["a", "c"]);
    sel = toggleSelection(sel, 1);
    expect(selectedItems(items, sel).map((i) => i.term)).toEqual(["a", "b", "c"]);
  });

  it("không sửa tập chọn cũ (bất biến) và giữ thứ tự gốc", () => {
    const sel = selectAll(items);
    const next = toggleSelection(sel, 0);
    expect(sel.has(0)).toBe(true);
    expect(next.has(0)).toBe(false);
    expect(selectedItems(items, new Set([2, 0])).map((i) => i.term)).toEqual(["a", "c"]);
  });
});

describe("aiItemToEditorItem", () => {
  it("chuyển sang dòng của bộ soạn: chuỗi rỗng cho trường thiếu, id mới mỗi dòng", () => {
    const a = aiItemToEditorItem(item({ reading: "nǐ hǎo", example: "你好！", exampleReading: "Nǐ hǎo!", exampleMeaning: "Xin chào!", note: "lời chào" }));
    expect(a).toMatchObject({ term: "你好", reading: "nǐ hǎo", meaning: "xin chào", example: "你好！", exampleReading: "Nǐ hǎo!", exampleMeaning: "Xin chào!", note: "lời chào", audioUrl: "" });
    const b = aiItemToEditorItem(item());
    expect(b).toMatchObject({ reading: "", example: "", note: "" });
    expect(a.id).not.toBe(b.id);
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("filledLabel", () => {
  it("tên trường AI đã điền bằng tiếng Việt", () => {
    expect(filledLabel(["reading", "meaning"])).toBe("phiên âm, nghĩa");
    expect(filledLabel(["example"])).toBe("ví dụ");
    expect(filledLabel([])).toBe("");
  });
});
