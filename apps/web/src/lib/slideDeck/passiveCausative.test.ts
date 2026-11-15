// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseEnglishSpans } from "@feedbackme/core-lms";
import { buildDeckLecture } from "../narration/deckLecture";
import { misplacedPauseMarks } from "../narration/deckSync";
import { loadDeck } from "./decks";

// docs/tieu-chi/slide-giang-song-ngu.md B1–B5: bộ slide Speakout 1.1 Grammar do Limio tự soạn.
const deck = loadDeck("passive-causative")!;
const BAO_TRANG = { xung: "cô", ten: "Bảo Trang" };
const doc = (html: string) => new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
/** Từ tiếng Anh thường gặp: nếu lọt ra ngoài [en: …], giọng Việt sẽ đọc sai. */
const ENGLISH_WORD = /\b(the|was|were|had|have|has|been|will|is|are|my|his|her|and|of|to|in)\b/i;

describe("bộ slide passive-causative", () => {
  it("có bộ slide, giọng Bảo Trang (nữ), dựng được lời giảng song ngữ trong giới hạn", () => {
    expect(deck).not.toBeNull();
    expect(deck.nguoiGiang).toMatchObject({ macDinh: "baotrang", xungHoHs: "em" });
    const lecture = buildDeckLecture(deck, BAO_TRANG);
    expect(lecture.length).toBeGreaterThanOrEqual(30);
    expect(lecture.length).toBeLessThanOrEqual(56);
    expect(new Set(lecture.map((s) => s.anchor)).size).toBe(lecture.length);
    expect(lecture.some((s) => /\[en:/.test(s.text))).toBe(true);
  });

  it("mọi đoạn [en: …] là tiếng Anh thuần (không dấu tiếng Việt), và chữ ngoài thẻ không có từ tiếng Anh", () => {
    for (const seg of buildDeckLecture(deck, BAO_TRANG)) {
      for (const span of parseEnglishSpans(seg.text)) {
        if (span.role === "en") expect(span.text, seg.anchor).not.toMatch(/[ăâđêôơưàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/i);
        else expect(span.text, `${seg.anchor}: ${span.text}`).not.toMatch(ENGLISH_WORD);
      }
    }
  });

  it("[chỉ: id] nào cũng trỏ vào một phần tử data-chi có thật trên slide đó; dấu dừng chỉ ở cuối bước", () => {
    for (const s of deck.slides) {
      const d = doc(s.html);
      const ids = new Set([...d.querySelectorAll("[data-chi]")].map((e) => e.getAttribute("data-chi")));
      for (const step of s.loiGiang?.buoc ?? []) {
        expect(misplacedPauseMarks(step), `${s.id}: ${step.slice(0, 50)}`).toEqual([]);
        for (const m of step.matchAll(/\[chỉ:\s*([^\]]+)\]/g)) expect(ids.has(m[1]!.trim()), `${s.id}: [chỉ: ${m[1]}]`).toBe(true);
      }
    }
  });

  it("mỗi ý hiện dần có một bước lời giảng (số bước ≥ số ý hiện dần + 1)", () => {
    for (const s of deck.slides) {
      const d = doc(s.html);
      const reveals = new Set<Element>();
      d.querySelectorAll(".hien, ul.hien-dan > li, ol.hien-dan > li, .quy-trinh > .buoc, .so-sanh > .cot").forEach((e) => reveals.add(e));
      expect((s.loiGiang?.buoc ?? []).length, s.id).toBeGreaterThanOrEqual(reveals.size + 1);
    }
  });

  it("thành phần tương tác đúng cấu trúc: một đáp án đúng mỗi câu trắc nghiệm, đủ cặp ghép, đáp án điền chữ có kiểu chu; mã data-kiem không trùng", () => {
    const kiem: string[] = [];
    for (const s of deck.slides) {
      const d = doc(s.html);
      d.querySelectorAll(".trac-nghiem").forEach((q) => {
        expect(q.querySelectorAll("button.lc.dung").length, `${s.id} trắc nghiệm`).toBe(1);
        expect(q.querySelectorAll("button.lc").length).toBeGreaterThanOrEqual(3);
        q.querySelectorAll("button.lc").forEach((b) => expect(b.getAttribute("data-phan-hoi") ?? "", s.id).not.toBe(""));
      });
      d.querySelectorAll(".ghep-doi").forEach((g) => expect(g.querySelectorAll(".cap").length, `${s.id} ghép đôi`).toBeGreaterThanOrEqual(3));
      d.querySelectorAll(".nhap-dap-an").forEach((n) => {
        expect(n.getAttribute("data-loai"), s.id).toBe("chu");
        expect(n.getAttribute("data-dap-an") ?? "", s.id).not.toBe("");
      });
      d.querySelectorAll("[data-kiem]").forEach((e) => kiem.push(e.getAttribute("data-kiem")!));
    }
    expect(new Set(kiem).size).toBe(kiem.length);
  });

  it("slide chờ học viên làm (dungCuoi) có thành phần để làm; không emoji", () => {
    for (const s of deck.slides) {
      if (s.loiGiang?.dungCuoi) expect(doc(s.html).querySelector(".trac-nghiem, .ghep-doi, .nhap-dap-an"), s.id).not.toBeNull();
      expect(JSON.stringify(s)).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
