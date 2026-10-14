import { describe, expect, it } from "vitest";
import {
  ScoreBandsInput,
  compareSectionResults,
  computeSectionResults,
  lookupScoreBand,
} from "../section-results";

/**
 * LANG G5d — kết quả theo phần của đề thi thử. Toàn bộ là hàm THUẦN (không DB):
 * dễ thử, và "ước lượng" luôn do giảng viên nhập chứ hệ thống không mang số liệu chính thức.
 */

const q = (id: string, points = 1) => ({ id, points });
const sec = (
  id: string,
  title: string,
  questions: { id: string; points: number }[],
  extra: { languageSkill?: string | null; scoreBands?: { from: number; to: number; label: string }[] | null } = {},
) => ({ id, title, languageSkill: extra.languageSkill ?? null, scoreBands: extra.scoreBands ?? null, questions });
const ans = (questionId: string, score: number | null, needsGrading = false, manual: number | null = null) => ({
  questionId,
  autoScore: score,
  manualScore: manual,
  needsGrading,
});

describe("computeSectionResults", () => {
  it("G5d.1: đếm đúng/tổng, điểm/điểm tối đa, số câu đã trả lời theo từng phần", () => {
    const r = computeSectionResults({
      sections: [sec("s1", "Nghe", [q("a"), q("b"), q("c")]), sec("s2", "Đọc", [q("d", 2), q("e", 2)])],
      answers: [ans("a", 1), ans("b", 0), /* c bỏ trống */ ans("d", 2), ans("e", 1)],
    });
    expect(r[0]).toMatchObject({ sectionId: "s1", questionCount: 3, answeredCount: 2, correctCount: 1, score: 1, maxScore: 3, pending: false });
    expect(r[1]).toMatchObject({ sectionId: "s2", questionCount: 2, answeredCount: 2, correctCount: 1, score: 3, maxScore: 4, pending: false });
  });

  it("câu bỏ trống (không có dòng đáp án) tính 0 điểm, không phải chờ chấm", () => {
    const [r] = computeSectionResults({ sections: [sec("s1", "Nghe", [q("a"), q("b")])], answers: [] });
    expect(r).toMatchObject({ answeredCount: 0, correctCount: 0, score: 0, maxScore: 2, pending: false });
  });

  it("chỉ đúng khi đạt TRỌN điểm câu; điểm một phần cộng vào điểm nhưng không tính là câu đúng", () => {
    const [r] = computeSectionResults({
      sections: [sec("s1", "Đọc", [q("a", 2), q("b", 2)])],
      answers: [ans("a", 1), ans("b", 2)],
    });
    expect(r).toMatchObject({ correctCount: 1, score: 3, maxScore: 4 });
  });

  it("G5d.2: có câu tự luận chờ chấm → phần pending, score null (KHÔNG hiện điểm giả), vẫn biết số câu chờ", () => {
    const [r] = computeSectionResults({
      sections: [sec("s1", "Viết", [q("a", 5), q("b", 5)])],
      answers: [ans("a", null, true), ans("b", 5)],
    });
    expect(r).toMatchObject({ pending: true, pendingCount: 1, score: null, maxScore: 10, estimate: null });
  });

  it("điểm phần chốt khi chấm xong: manualScore thay cho autoScore, hết pending", () => {
    const [r] = computeSectionResults({
      sections: [sec("s1", "Viết", [q("a", 5)])],
      answers: [ans("a", null, false, 4)],
    });
    expect(r).toMatchObject({ pending: false, score: 4, maxScore: 5, correctCount: 0 });
  });

  it("phần không có câu nào: 0/0, không chia cho 0, không pending", () => {
    const [r] = computeSectionResults({ sections: [sec("s1", "Rỗng", [])], answers: [] });
    expect(r).toMatchObject({ questionCount: 0, score: 0, maxScore: 0, pending: false });
  });

  it("G5d.3: có bảng quy đổi → nhãn ước lượng theo điểm của phần; không có bảng → null", () => {
    const bands = [
      { from: 0, to: 4, label: "100–150" },
      { from: 5, to: 8, label: "150–200" },
    ];
    const withBands = computeSectionResults({
      sections: [sec("s1", "Nghe", [q("a", 3), q("b", 3), q("c", 3)], { scoreBands: bands })],
      answers: [ans("a", 3), ans("b", 3), ans("c", 0)],
    });
    expect(withBands[0]!.estimate).toBe("150–200"); // 6 điểm
    const without = computeSectionResults({ sections: [sec("s1", "Nghe", [q("a")])], answers: [ans("a", 1)] });
    expect(without[0]!.estimate).toBeNull();
  });

  it("giữ thứ tự phần và kỹ năng của phần", () => {
    const r = computeSectionResults({
      sections: [sec("x", "Nghe", [], { languageSkill: "listening" }), sec("y", "Đọc", [], { languageSkill: "reading" })],
      answers: [],
    });
    expect(r.map((s) => [s.sectionId, s.languageSkill])).toEqual([["x", "listening"], ["y", "reading"]]);
  });
});

describe("lookupScoreBand / ScoreBandsInput", () => {
  const bands = [
    { from: 0, to: 9, label: "A" },
    { from: 10, to: 19, label: "B" },
  ];
  it("tìm đúng khoảng, kể cả biên; ngoài mọi khoảng → null", () => {
    expect(lookupScoreBand(bands, 0)).toBe("A");
    expect(lookupScoreBand(bands, 9)).toBe("A");
    expect(lookupScoreBand(bands, 10)).toBe("B");
    expect(lookupScoreBand(bands, 20)).toBeNull();
    expect(lookupScoreBand(null, 5)).toBeNull();
  });
  it("hợp lệ: các khoảng không chồng nhau, from ≤ to, nhãn 1–40 ký tự", () => {
    expect(ScoreBandsInput.safeParse(bands).success).toBe(true);
    expect(ScoreBandsInput.safeParse([]).success).toBe(true); // rỗng = bỏ bảng
  });
  it("từ chối: chồng nhau, from > to, nhãn rỗng/quá dài, quá 40 khoảng, điểm âm", () => {
    const bad = (v: unknown) => ScoreBandsInput.safeParse(v).success;
    expect(bad([{ from: 0, to: 10, label: "A" }, { from: 10, to: 20, label: "B" }])).toBe(false);
    expect(bad([{ from: 5, to: 1, label: "A" }])).toBe(false);
    expect(bad([{ from: 0, to: 1, label: "" }])).toBe(false);
    expect(bad([{ from: 0, to: 1, label: "x".repeat(41) }])).toBe(false);
    expect(bad([{ from: -1, to: 1, label: "A" }])).toBe(false);
    expect(bad(Array.from({ length: 41 }, (_, i) => ({ from: i * 2, to: i * 2 + 1, label: "L" })))).toBe(false);
  });
});

describe("compareSectionResults (G5d.4)", () => {
  const mk = (sectionId: string, score: number | null, maxScore = 10) => ({
    sectionId, title: sectionId, languageSkill: null, questionCount: 0, answeredCount: 0, correctCount: 0,
    score, maxScore, pending: score === null, pendingCount: score === null ? 1 : 0, estimate: null,
  });
  it("tăng · giảm · không đổi theo TỈ LỆ điểm của từng phần", () => {
    const d = compareSectionResults(
      [mk("a", 8), mk("b", 3), mk("c", 5)],
      [mk("a", 5), mk("b", 6), mk("c", 5)],
    );
    expect(d).toEqual({ a: "up", b: "down", c: "same" });
  });
  it("so theo tỉ lệ nên đề đổi số điểm tối đa vẫn so được", () => {
    expect(compareSectionResults([mk("a", 10, 20)], [mk("a", 4, 10)])).toEqual({ a: "up" });
  });
  it("chưa có lượt trước, hoặc phần pending ở một trong hai lượt, hoặc thiếu phần → null (không bịa)", () => {
    expect(compareSectionResults([mk("a", 5)], null)).toEqual({ a: null });
    expect(compareSectionResults([mk("a", null)], [mk("a", 5)])).toEqual({ a: null });
    expect(compareSectionResults([mk("a", 5)], [mk("a", null)])).toEqual({ a: null });
    expect(compareSectionResults([mk("a", 5)], [mk("z", 5)])).toEqual({ a: null });
  });
  it("phần có maxScore 0 → null", () => {
    expect(compareSectionResults([mk("a", 0, 0)], [mk("a", 0, 0)])).toEqual({ a: null });
  });
});
