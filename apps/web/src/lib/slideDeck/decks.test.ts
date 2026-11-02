import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDeckHtml, isDeckId, loadDeck } from "./decks";
import { misplacedPauseMarks, parseStepPause, stepPausesOf } from "../narration/deckSync";
import { cleanNarration } from "../smartdocConvert";

/** Năm bài của khoá Toán 10. Soạn theo docs/tieu-chi/dung-nghi-loi-giang-slide.md. */
const TOAN_10 = ["conic", "ham-bac-hai", "tam-giac", "toi-uu", "xac-suat"];
/** Câu bảo học sinh thao tác trên slide: phải nằm ở bước có điểm dừng. */
const GIAO_THAO_TAC = /(?:^|[\s.!?:,])em (?:thử(?! nghĩ)|kéo|bấm|chọn|nhập|gieo)(?=[\s,.!?:;]|$)/iu;
/** Câu có cùng từ ngữ nhưng không bảo học sinh làm gì ngay: dặn bài về nhà, kể tình huống đo đạc. */
const KHONG_PHAI_GIAO_VIEC = new Set(["t10-19:5", "tg-08:0"]);

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
    // Giao diện Limio, mở bằng nền sáng.
    const root = html.slice(0, html.indexOf(">", html.indexOf("<html")));
    expect(root).toContain('data-mau="limio"');
    expect(root).not.toContain("data-theme");
    // Slide chờ học viên làm (dungCuoi) mang cờ để trình chiếu dừng giọng; slide thường thì không.
    const waits = deck.slides.filter((s) => s.loiGiang?.dungCuoi).length;
    expect((html.match(/<section data-dung-cuoi="1"/g) ?? []).length).toBe(waits);
    // Công thức đã thành HTML KaTeX: phần slide (trước thẻ script đầu tiên) không còn \(…\) thô.
    expect(html.slice(0, html.indexOf("<script"))).not.toContain("\\(");
  });

  it.each(ids)("%s: dấu dừng chỉ nằm ở cuối bước, slide chờ không dừng hai lần ở bước cuối", (id) => {
    for (const s of loadDeck(id)!.slides) {
      const steps = s.loiGiang?.buoc ?? [];
      for (const step of steps) expect(misplacedPauseMarks(step), `${s.id}: ${step.slice(0, 60)}`).toEqual([]);
      if (s.loiGiang?.dungCuoi && steps.length) expect(parseStepPause(steps[steps.length - 1]!), s.id).toBeNull();
    }
  });

  it.each(TOAN_10)("%s: giao thao tác cho học sinh thì giọng phải dừng", (id) => {
    const slides = loadDeck(id)!.slides;
    // Slide cuối là tổng kết, chỉ dặn bài về nhà.
    slides.slice(0, -1).forEach((s) => {
      const steps = s.loiGiang?.buoc ?? [];
      steps.forEach((step, b) => {
        const stops = parseStepPause(step) !== null || (!!s.loiGiang?.dungCuoi && b === steps.length - 1);
        if (!stops && !KHONG_PHAI_GIAO_VIEC.has(`${s.id}:${b}`)) expect(GIAO_THAO_TAC.test(cleanNarration([step], { xung: "thầy", ten: "Tiến Đạt" })), `${s.id} bước ${b}: ${step.slice(0, 80)}`).toBe(false);
      });
    });
  });

  it.each(TOAN_10)("%s: mọi điểm dừng lên được slide, chữ lời nhắc không lọt vào lời giảng", (id) => {
    const deck = loadDeck(id)!;
    const html = buildDeckHtml(deck);
    const withPause = deck.slides.filter((s) => stepPausesOf(s.loiGiang?.buoc ?? []));
    expect(withPause.length).toBeGreaterThan(0);
    expect((html.match(/data-dung-buoc="/g) ?? []).length).toBe(withPause.length);
    for (const s of withPause) {
      const table = stepPausesOf(s.loiGiang!.buoc!)!;
      for (const b of Object.keys(table)) {
        expect(cleanNarration([s.loiGiang!.buoc![Number(b)]!], { xung: "thầy", ten: "Tiến Đạt" }), `${s.id} bước ${b}`).not.toMatch(/\[|\]/);
      }
    }
  });
});
