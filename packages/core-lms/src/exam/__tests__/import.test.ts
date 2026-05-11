import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseExamQuestionsXlsx, type ImportContext } from "../import";

/** Build an xlsx Buffer from an array of row objects. */
function buildXlsx(rows: Array<Record<string, string | number>>): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Questions");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function ctx(opts: Partial<ImportContext> = {}): ImportContext {
  return {
    existingPassages: [],
    existingSkillCodes: new Set(),
    ...opts,
  };
}

describe("parseExamQuestionsXlsx", () => {
  it("parses a valid MCQ row", () => {
    const buf = buildXlsx([
      {
        Type: "mcq",
        Prompt: "1 + 1 = ?",
        Points: 5,
        OptionA: "1",
        OptionB: "2",
        OptionC: "3",
        Correct: "B",
        SkillCodes: "math.basic",
      },
    ]);
    const r = parseExamQuestionsXlsx(
      buf,
      ctx({
        existingSkillCodes: new Set(["math.basic"]),
        skillIdByCode: new Map([["math.basic", "skill-1"]]),
      }),
    );
    expect(r.summary).toEqual({ ok: 1, warning: 0, error: 0, total: 1 });
    const parsed = r.rows[0]!.parsed!;
    expect(parsed.type).toBe("mcq");
    expect(parsed.points).toBe(5);
    expect(parsed.difficulty).toBe(2);
    expect(parsed.skillIds).toEqual(["skill-1"]);
    expect((parsed.config as { options: Array<{ id: string; isCorrect: boolean }> }).options.find(o => o.id === "b")?.isCorrect).toBe(true);
  });

  it("MCQ with 2 correct → error", () => {
    const buf = buildXlsx([
      {
        Type: "mcq",
        Prompt: "Q",
        Points: 1,
        OptionA: "a",
        OptionB: "b",
        Correct: "A;B",
      },
    ]);
    const r = parseExamQuestionsXlsx(buf, ctx());
    expect(r.rows[0]!.status).toBe("error");
    expect(r.rows[0]!.errors.join(" ")).toMatch(/MCQ cần đúng 1/);
  });

  it("MULTI with multiple correct", () => {
    const buf = buildXlsx([
      {
        Type: "multi",
        Prompt: "Pick all even numbers",
        Points: 3,
        OptionA: "2",
        OptionB: "3",
        OptionC: "4",
        Correct: "A;C",
      },
    ]);
    const r = parseExamQuestionsXlsx(buf, ctx());
    expect(r.rows[0]!.status).toBe("ok");
    const opts = (r.rows[0]!.parsed!.config as { options: Array<{ id: string; isCorrect: boolean }> }).options;
    expect(opts.filter((o) => o.isCorrect).map((o) => o.id)).toEqual(["a", "c"]);
  });

  it("TRUE_FALSE_NOTGIVEN", () => {
    const buf = buildXlsx([
      { Type: "true_false_notgiven", Prompt: "Sky is blue.", Points: 2, Correct: "true" },
    ]);
    const r = parseExamQuestionsXlsx(buf, ctx());
    expect(r.rows[0]!.status).toBe("ok");
    expect((r.rows[0]!.parsed!.config as { correct: string }).correct).toBe("true");
  });

  it("TRUE_FALSE_NOTGIVEN invalid correct → error", () => {
    const buf = buildXlsx([
      { Type: "true_false_notgiven", Prompt: "Q", Points: 1, Correct: "maybe" },
    ]);
    const r = parseExamQuestionsXlsx(buf, ctx());
    expect(r.rows[0]!.status).toBe("error");
  });

  it("GAP_FILL with multiple blanks", () => {
    const buf = buildXlsx([
      {
        Type: "gap_fill",
        Prompt: "Capitals: France __, Japan __",
        Points: 4,
        Blanks: "b1:paris|Paris ; b2:tokyo|Tokyo",
      },
    ]);
    const r = parseExamQuestionsXlsx(buf, ctx());
    expect(r.rows[0]!.status).toBe("ok");
    const blanks = (r.rows[0]!.parsed!.config as { blanks: Array<{ id: string; acceptedAnswers: string[] }> }).blanks;
    expect(blanks).toHaveLength(2);
    expect(blanks[0]!.acceptedAnswers).toEqual(["paris", "Paris"]);
  });

  it("SHORT_ANSWER with accepted list + exact match mode", () => {
    const buf = buildXlsx([
      {
        Type: "short_answer",
        Prompt: "Capital of France?",
        Points: 2,
        AcceptedAnswers: "Paris ; PARIS",
        MatchMode: "exact",
      },
    ]);
    const r = parseExamQuestionsXlsx(buf, ctx());
    expect(r.rows[0]!.status).toBe("ok");
    const cfg = r.rows[0]!.parsed!.config as { acceptedAnswers: string[]; matchMode: string };
    expect(cfg.acceptedAnswers).toEqual(["Paris", "PARIS"]);
    expect(cfg.matchMode).toBe("exact");
  });

  it("ESSAY with rubric + minWords", () => {
    const buf = buildXlsx([
      {
        Type: "essay",
        Prompt: "Explain Gauss elimination.",
        Points: 10,
        Rubric: "3 steps required",
        MinWords: "100",
      },
    ]);
    const r = parseExamQuestionsXlsx(buf, ctx());
    expect(r.rows[0]!.status).toBe("ok");
    const cfg = r.rows[0]!.parsed!.config as { rubric: string; minWords: number };
    expect(cfg.rubric).toBe("3 steps required");
    expect(cfg.minWords).toBe(100);
  });

  it("Invalid type → error", () => {
    const buf = buildXlsx([
      { Type: "matching_heading", Prompt: "x", Points: 1 },
    ]);
    const r = parseExamQuestionsXlsx(buf, ctx());
    expect(r.rows[0]!.status).toBe("error");
    expect(r.rows[0]!.errors.join(" ")).toMatch(/không hợp lệ/);
  });

  it("Missing prompt → error", () => {
    const buf = buildXlsx([
      { Type: "mcq", Prompt: "", Points: 1, OptionA: "a", OptionB: "b", Correct: "A" },
    ]);
    const r = parseExamQuestionsXlsx(buf, ctx());
    expect(r.rows[0]!.status).toBe("error");
    expect(r.rows[0]!.errors.join(" ")).toMatch(/Prompt/i);
  });

  it("Unknown PassageTitle → warning, treated as standalone", () => {
    const buf = buildXlsx([
      {
        Type: "mcq",
        Prompt: "Q",
        Points: 1,
        OptionA: "a",
        OptionB: "b",
        Correct: "A",
        PassageTitle: "Đoạn không tồn tại",
      },
    ]);
    const r = parseExamQuestionsXlsx(
      buf,
      ctx({ existingPassages: [{ id: "p1", title: "Đoạn 1" }] }),
    );
    expect(r.rows[0]!.status).toBe("warning");
    expect(r.rows[0]!.parsed!.passageId).toBeNull();
    expect(r.rows[0]!.warnings.join(" ")).toMatch(/Không tìm thấy đoạn/);
  });

  it("Matching PassageTitle (case-insensitive)", () => {
    const buf = buildXlsx([
      {
        Type: "mcq",
        Prompt: "Q",
        Points: 1,
        OptionA: "a",
        OptionB: "b",
        Correct: "A",
        PassageTitle: "  đoạn 1  ",
      },
    ]);
    const r = parseExamQuestionsXlsx(
      buf,
      ctx({ existingPassages: [{ id: "p1", title: "Đoạn 1" }] }),
    );
    expect(r.rows[0]!.status).toBe("ok");
    expect(r.rows[0]!.parsed!.passageId).toBe("p1");
  });

  it("Unknown SkillCode → warning", () => {
    const buf = buildXlsx([
      {
        Type: "mcq",
        Prompt: "Q",
        Points: 1,
        OptionA: "a",
        OptionB: "b",
        Correct: "A",
        SkillCodes: "math.unknown",
      },
    ]);
    const r = parseExamQuestionsXlsx(buf, ctx());
    expect(r.rows[0]!.status).toBe("warning");
    expect(r.rows[0]!.warnings.join(" ")).toMatch(/Skill code không tồn tại/);
  });

  it("Blank rows skipped", () => {
    const buf = buildXlsx([
      { Type: "mcq", Prompt: "Q", Points: 1, OptionA: "a", OptionB: "b", Correct: "A" },
      { Type: "" },
      { Type: "true_false_notgiven", Prompt: "Q2", Points: 1, Correct: "false" },
    ]);
    const r = parseExamQuestionsXlsx(buf, ctx());
    expect(r.summary.total).toBe(2);
  });

  it("Header case-insensitive (TYPE, prompt, POINTS)", () => {
    const buf = buildXlsx([
      { TYPE: "essay", prompt: "Explain", POINTS: 5, RUBRIC: "..." },
    ]);
    const r = parseExamQuestionsXlsx(buf, ctx());
    expect(r.rows[0]!.status).toBe("ok");
    expect(r.rows[0]!.parsed!.type).toBe("essay");
  });

  it("Difficulty parsing", () => {
    const buf = buildXlsx([
      { Type: "essay", Prompt: "Q", Points: 5, Difficulty: "3" },
      { Type: "essay", Prompt: "Q", Points: 5, Difficulty: "5" },
    ]);
    const r = parseExamQuestionsXlsx(buf, ctx());
    expect(r.rows[0]!.parsed?.difficulty).toBe(3);
    expect(r.rows[1]!.status).toBe("error");
  });

  it("Respects maxRows option", () => {
    const buf = buildXlsx(
      Array.from({ length: 5 }, (_, i) => ({
        Type: "essay",
        Prompt: `Q${i}`,
        Points: 1,
      })),
    );
    const r = parseExamQuestionsXlsx(buf, ctx(), { maxRows: 3 });
    expect(r.summary.total).toBe(3);
  });
});
