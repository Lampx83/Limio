import { describe, expect, it } from "vitest";
import { buildDeckLecture } from "./deckLecture";

const BAO_TRANG = { xung: "cô", ten: "Bảo Trang" };

// docs/tieu-chi/slide-giang-song-ngu.md S2, S4, L1, L2.
describe("buildDeckLecture", () => {
  it("mỗi bước một đoạn, anchor s<slide>b<bước>; giữ nguyên thẻ [en: …] và thay xưng hô ngoài thẻ", () => {
    const out = buildDeckLecture(
      { slides: [{ id: "a", loiGiang: { buoc: ["{{Tx}} nói [en: I had my car repaired] nhé.", "Bước hai."] } }, { id: "b" }, { id: "c", loiGiang: { buoc: ["Slide ba."] } }] },
      BAO_TRANG,
    );
    expect(out).toEqual([
      { anchor: "s0b0", text: "Cô nói [en: I had my car repaired] nhé." },
      { anchor: "s0b1", text: "Bước hai." },
      { anchor: "s2b0", text: "Slide ba." },
    ]);
  });

  it("thẻ nhịp đứng cạnh thẻ tiếng Anh vẫn được bỏ, chữ tiếng Anh còn nguyên", () => {
    const [seg] = buildDeckLecture({ slides: [{ loiGiang: { buoc: ["[chỉ: vd] Nghe nhé: [en: She had her hair done.] [chờ: Em thử nhắc lại]"] } }] }, BAO_TRANG);
    expect(seg!.text).toBe("Nghe nhé: [en: She had her hair done.]");
  });

  it("thẻ sai làm dựng bài lỗi, nói rõ slide và bước", () => {
    expect(() => buildDeckLecture({ slides: [{ id: "x" }, { id: "y", loiGiang: { buoc: ["ok", "Ta nói [en: thiếu đóng"] } }] }, BAO_TRANG)).toThrow(
      /Slide 2 \(y\), bước 2: thẻ \[en: …\] thiếu dấu \] đóng/,
    );
    expect(() => buildDeckLecture({ slides: [{ loiGiang: { buoc: ["[en: ]"] } }] }, BAO_TRANG)).toThrow(/đang rỗng/);
  });

  it("bộ slide Toán 10 không đổi: không đoạn nào chứa thẻ tiếng Anh", async () => {
    const { loadDeck } = await import("../slideDeck/decks");
    for (const id of ["conic", "ham-bac-hai", "tam-giac", "toi-uu", "xac-suat"]) {
      const deck = loadDeck(id);
      if (!deck) continue;
      expect(buildDeckLecture(deck, { xung: "thầy", ten: "Tiến Đạt" }).some((s) => /\[en\s*:/i.test(s.text))).toBe(false);
    }
  });
});
