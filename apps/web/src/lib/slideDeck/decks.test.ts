import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDeckHtml, isDeckId, loadDeck } from "./decks";

const ids = readdirSync(path.join(process.cwd(), "src", "content", "decks")).map((f) => f.replace(/\.json$/, ""));

describe("bộ slide tương tác", () => {
  it("có bộ slide và mã nào cũng hợp lệ", () => {
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(isDeckId(id)).toBe(true);
  });

  it("mã lạ không đọc được tệp (chống ../ và ký tự đặc biệt)", () => {
    for (const bad of ["../package", "a/b", "A", "x.json", "", "a".repeat(61)]) {
      expect(isDeckId(bad)).toBe(false);
      expect(loadDeck(bad)).toBeNull();
    }
    expect(loadDeck("khong-co-bo-nay")).toBeNull();
  });

  it.each(ids)("%s: dựng đủ slide, có khung điều khiển và công thức KaTeX", (id) => {
    const deck = loadDeck(id)!;
    const html = buildDeckHtml(deck);
    expect((html.match(/<section/g) ?? []).length).toBeGreaterThanOrEqual(deck.slides.length);
    expect(html).toContain('data-kieu="hoclieu"');
    // Có sẵn CSS ẩn thanh đáy nhưng chưa bật: bài đọc thường vẫn lật slide được, trình chiếu mới bật (useDeckBridge).
    expect(html).toContain("html[data-an-thanh]");
    expect(html).not.toContain('data-an-thanh="1"');
    expect(html).toContain("katex");
    // Công thức đã thành HTML KaTeX: phần slide (trước thẻ script đầu tiên) không còn \(…\) thô.
    expect(html.slice(0, html.indexOf("<script"))).not.toContain("\\(");
  });
});
