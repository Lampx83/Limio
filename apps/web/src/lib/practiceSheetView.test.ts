import { describe, expect, it } from "vitest";
import {
  BLANK_MAX_CH,
  BLANK_MIN_CH,
  blankCountOf,
  blankWidthCh,
  choicesFitInline,
  groupSharedOptions,
  letterOf,
  questionsToCheck,
  revealText,
  sheetKind,
  sheetStatus,
  splitBlankPrompt,
  splitDragPrompt,
  tabShortLabels,
  tabLabel,
} from "./practiceSheetView";

describe("splitBlankPrompt", () => {
  it("tách theo dấu gạch dưới, theo thứ tự", () => {
    expect(splitBlankPrompt("She ______ really hard.", 1)).toEqual([
      { kind: "text", text: "She " },
      { kind: "blank", index: 0 },
      { kind: "text", text: " really hard." },
    ]);
    expect(splitBlankPrompt("look ______ ______ : be excited", 2).filter((s) => s.kind === "blank")).toEqual([
      { kind: "blank", index: 0 },
      { kind: "blank", index: 1 },
    ]);
  });
  it("đề không có dấu: ô nằm ngay sau chữ; thiếu dấu so với số ô thì nối ô còn lại vào cuối", () => {
    expect(splitBlankPrompt("Which country is the second largest?", 1)).toEqual([
      { kind: "text", text: "Which country is the second largest?" },
      { kind: "text", text: " " },
      { kind: "blank", index: 0 },
    ]);
    const two = splitBlankPrompt("I ______ it and ", 2);
    expect(two.filter((s) => s.kind === "blank")).toHaveLength(2);
  });
  it("dư dấu so với số ô thì phần dư giữ là chữ; hai dấu gạch dưới không phải chỗ trống", () => {
    expect(splitBlankPrompt("a ______ b ______ c", 1).filter((s) => s.kind === "blank")).toHaveLength(1);
    expect(splitBlankPrompt("snake__case", 1).filter((s) => s.kind === "blank")).toHaveLength(1); // chỉ ô nối cuối
    expect(splitBlankPrompt("snake__case", 1)[0]).toEqual({ kind: "text", text: "snake__case" });
  });
});

describe("độ rộng ô điền", () => {
  it("có tối thiểu và tối đa, nở theo chữ đang gõ", () => {
    expect(blankWidthCh("")).toBe(BLANK_MIN_CH);
    expect(blankWidthCh("is grown")).toBe(10);
    expect(blankWidthCh("x".repeat(100))).toBe(BLANK_MAX_CH);
  });
});

describe("câu chọn ngắn (khoanh) hay danh sách dọc", () => {
  it("2–3 lựa chọn ngắn thì khoanh; dài, nhiều lựa chọn hoặc tổng quá 60 thì danh sách", () => {
    expect(choicesFitInline(["True", "False"])).toBe(true);
    expect(choicesFitInline(["love", "am loving"])).toBe(true);
    expect(choicesFitInline(["a", "b", "c", "d"])).toBe(false);
    expect(choicesFitInline(["present continuous: used for something"])).toBe(false);
    expect(choicesFitInline(["x".repeat(18), "y".repeat(18), "z".repeat(18)])).toBe(true); // đúng ngưỡng
    expect(choicesFitInline(["x".repeat(19), "y"])).toBe(false);
  });
});

describe("sheetKind", () => {
  const opts = (labels: string[]) => ({ options: labels.map((l, i) => ({ id: `o${i}`, label: l })) });
  it("map dạng câu sang cách dựng", () => {
    expect(sheetKind({ type: "gap_fill", config: {} })).toBe("gap");
    expect(sheetKind({ type: "short_answer", config: {} })).toBe("gap");
    expect(sheetKind({ type: "mcq", config: opts(["True", "False"]) })).toBe("choice-inline");
    expect(sheetKind({ type: "mcq", config: opts(["A long sentence option here", "Another long sentence option"]) })).toBe("choice-list");
    expect(sheetKind({ type: "multi", config: opts(["a", "b"]) })).toBe("multi-list");
    expect(sheetKind({ type: "true_false_notgiven", config: {} })).toBe("tfng");
    expect(sheetKind({ type: "matching", config: {} })).toBe("matching");
    expect(sheetKind({ type: "ordering", config: {} })).toBe("ordering");
    expect(sheetKind({ type: "drag_drop_fill", config: {} })).toBe("drag");
    expect(sheetKind({ type: "numerical", config: {} })).toBe("numerical");
    expect(sheetKind({ type: "essay", config: {} })).toBe("essay");
    expect(sheetKind({ type: "weird", config: {} })).toBe("other");
  });
  it("blankCountOf: đếm ô, tối thiểu một", () => {
    expect(blankCountOf({ type: "gap_fill", config: { blanks: [{ id: "b1" }, { id: "b2" }] } })).toBe(2);
    expect(blankCountOf({ type: "short_answer", config: {} })).toBe(1);
  });
});

describe("tab và ô thả", () => {
  it("nhãn tab lấy tiêu đề đoạn văn, không thì 'Bài n'", () => {
    expect(tabLabel("Exercise 3A", 0)).toBe("Exercise 3A");
    expect(tabLabel("  ", 1)).toBe("Bài 2");
    expect(tabLabel(null, 2)).toBe("Bài 3");
  });
  it("splitDragPrompt tách [[n]]; letterOf cho vế phải", () => {
    expect(splitDragPrompt("I [[1]] and [[2]].")).toEqual([
      { kind: "text", text: "I " },
      { kind: "slot", slot: "1" },
      { kind: "text", text: " and " },
      { kind: "slot", slot: "2" },
      { kind: "text", text: "." },
    ]);
    expect([0, 1, 2].map(letterOf)).toEqual(["a", "b", "c"]);
  });
});

describe("chọn câu cần chấm và tóm tắt chân phiếu", () => {
  const set = (xs: string[]) => (id: string) => xs.includes(id);
  it("chỉ câu đã trả lời, chưa chấm, không nạp lại, không tự luận", () => {
    const ids = ["a", "b", "c", "d", "e"];
    expect(
      questionsToCheck(ids, { answered: set(["a", "b", "c", "e"]), checked: set(["b"]), restoring: set(["c"]), isEssay: set(["e"]) }),
    ).toEqual(["a"]);
  });
  it("sheetStatus: 'Đúng x / y' trên câu đã chấm, 'còn n câu chưa làm', bỏ tự luận; rỗng khi chưa có gì", () => {
    const st = { answered: set(["a", "b", "c"]), checked: set(["a", "b"]), correct: set(["a"]), isEssay: set(["z"]) };
    expect(sheetStatus(["a", "b", "c", "d", "z"], st)).toBe("Đúng 1 / 2 · còn 1 câu chưa làm");
    expect(sheetStatus(["c"], { ...st, checked: set([]) })).toBe("");
    expect(sheetStatus(["d"], { ...st, checked: set([]) })).toBe("Còn 1 câu chưa làm");
  });
});

describe("revealText", () => {
  it("điền chỗ trống: đáp án đầu của từng ô; chọn: nhãn đáp án đúng; đúng/sai", () => {
    expect(revealText("gap_fill", { blanks: [{ acceptedAnswers: ["forward"] }, { acceptedAnswers: ["to", "too"] }] })).toBe("forward · to");
    expect(revealText("mcq", { options: [{ label: "A", isCorrect: false }, { label: "B", isCorrect: true }] })).toBe("B");
    expect(revealText("multi", { options: [{ label: "A", isCorrect: true }, { label: "B", isCorrect: true }] })).toBe("A / B");
    expect(revealText("true_false_notgiven", { correct: "notgiven" })).toBe("NOT GIVEN");
  });
  it("dạng cần trình bày đầy đủ hơn hoặc dữ liệu hỏng thì null", () => {
    expect(revealText("matching", {})).toBeNull();
    expect(revealText("gap_fill", { blanks: [{ acceptedAnswers: [] }] })).toBeNull();
    expect(revealText("mcq", null)).toBeNull();
  });
});

describe("groupSharedOptions", () => {
  const L = ["present continuous: a changing situation", "present simple: a fact or something always true"];
  const mcq = (id: string, labels = L) => ({ id, type: "mcq", labels });
  it("từ 3 câu liền nhau cùng bộ lựa chọn dài thì gộp thành một nhóm", () => {
    expect(groupSharedOptions([mcq("a"), mcq("b"), mcq("c")])).toEqual([{ kind: "shared", ids: ["a", "b", "c"], labels: L }]);
  });
  it("dưới 3 câu, lựa chọn khác nhau, lựa chọn ngắn hay dạng khác thì không gộp; nhóm không nuốt câu lạc loại ở giữa", () => {
    expect(groupSharedOptions([mcq("a"), mcq("b")])).toEqual([{ kind: "single", id: "a" }, { kind: "single", id: "b" }]);
    expect(groupSharedOptions([mcq("a"), mcq("b"), mcq("c", ["x long option one", "y long option two"])]).every((r) => r.kind === "single")).toBe(true);
    expect(groupSharedOptions([mcq("a", ["True", "False"]), mcq("b", ["True", "False"]), mcq("c", ["True", "False"])]).every((r) => r.kind === "single")).toBe(true);
    const mixed = groupSharedOptions([mcq("a"), mcq("b"), { id: "g", type: "gap_fill", labels: [] }, mcq("c"), mcq("d"), mcq("e")]);
    expect(mixed).toEqual([{ kind: "single", id: "a" }, { kind: "single", id: "b" }, { kind: "single", id: "g" }, { kind: "shared", ids: ["c", "d", "e"], labels: L }]);
  });
});

describe("tabShortLabels", () => {
  it("mã bài tập của sách thành nhãn ngắn", () => {
    expect(tabShortLabels(["Exercise 7A · Three lifestyles", "Ex 3B · Match the sentences", "Ex 2B–2C · ▶ 1.3", "Ex 4A · Find and correct the mistakes"])).toEqual(["7A", "3B", "2B–2C", "4A"]);
  });
  it("tiêu đề theo kiểu sách, không có chữ Ex: '2A · …' cũng ra nhãn ngắn", () => {
    expect(tabShortLabels(["2A · Talk with a virtual partner", "3A\u20133B · Make sentences", "5B\u20135C · Stress patterns", "Ex 7D · True or false?"])).toEqual(["2A", "3A\u20133B", "5B\u20135C", "7D"]);
  });
  it("không có mã: lấy phần sau dấu ·, hoặc tiêu đề cắt ngắn, hoặc 'Bài n'", () => {
    expect(tabShortLabels(["Choose the alternatives · Conversation 1", "Listening · ▶ 1.7", "A very long title without a code at all", "", null])).toEqual(["Conversation 1", "▶ 1.7", "A very long t…", "Bài 4", "Bài 5"]);
  });
  it("hai tab trùng nhãn ngắn thì thêm mô tả để phân biệt", () => {
    expect(tabShortLabels(["Exercise 7B · take and hand", "Exercise 7B · put, look and keep", "Exercise 7C · Complete the examples"])).toEqual(["7B take and h…", "7B put, look…", "7C"]);
  });
});
