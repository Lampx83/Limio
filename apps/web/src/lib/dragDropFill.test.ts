import { describe, it, expect } from "vitest";
import { blankIndexes, compose, mk, rebuild, split, tokenize, type BuildTok } from "./dragDropFill";

function click(text: string, options: ReturnType<typeof mk>[], word: string) {
  const { answers, distractors } = split(options);
  const tokens = tokenize(text);
  const idx = tokens.findIndex((t) => t.kind === "word" && t.core === word);
  const t = tokens[idx]!;
  if (t.kind !== "word") throw new Error("not a word");
  const next: BuildTok[] = tokens.flatMap((x, i): BuildTok[] =>
    i === idx
      ? [
          ...(t.lead ? [{ kind: "space" as const, text: t.lead }] : []),
          { kind: "new" as const, label: t.core },
          ...(t.trail ? [{ kind: "space" as const, text: t.trail }] : []),
        ]
      : [x],
  );
  return rebuild(next, answers, distractors);
}

describe("bấm từ để tạo ô trống", () => {
  it("biến từ thành [[1]] và đặt từ đó làm đáp án", () => {
    const r = click("Một đội bóng có 11 cầu thủ", [], "11");
    expect(r.prompt).toBe("Một đội bóng có [[1]] cầu thủ");
    expect(r.options.map((o) => [o.label, o.blankIndex])).toEqual([["11", 1]]);
  });

  it("không nuốt dấu câu dính vào từ", () => {
    const r = click("Có 2 hiệp, mỗi hiệp 45 phút.", [], "45");
    expect(r.prompt).toBe("Có 2 hiệp, mỗi hiệp [[1]] phút.");
    const r2 = click("Có 2 hiệp, mỗi hiệp 45 phút.", [], "hiệp");
    expect(r2.prompt).toBe("Có 2 [[1]], mỗi hiệp 45 phút.");
  });

  it("đánh số lại theo thứ tự xuất hiện và chuyển đáp án theo số mới", () => {
    // Đã có ô 1 = "45" ở cuối câu; bấm thêm "11" đứng trước → "11" thành ô 1, "45" thành ô 2.
    const opts = [mk("45", 1), mk("nhiễu", null)];
    const r = click("Đội có 11 cầu thủ, mỗi hiệp [[1]] phút", opts, "11");
    expect(r.prompt).toBe("Đội có [[1]] cầu thủ, mỗi hiệp [[2]] phút");
    expect(r.options.map((o) => [o.label, o.blankIndex])).toEqual([
      ["11", 1],
      ["45", 2],
      ["nhiễu", null],
    ]);
  });
});

describe("blankIndexes / compose", () => {
  it("lấy các ô duy nhất theo thứ tự tăng", () => {
    expect(blankIndexes("a [[2]] b [[1]] c [[2]]")).toEqual([1, 2]);
  });
  it("bỏ option của ô không còn trong câu, thêm dòng trống cho ô mới", () => {
    const { answers, distractors } = split([mk("x", 1), mk("y", 3), mk("z", null)]);
    const out = compose([1, 2], answers, distractors);
    expect(out.map((o) => [o.label, o.blankIndex])).toEqual([
      ["x", 1],
      ["", 2],
      ["z", null],
    ]);
  });
});

import { blankifyAt } from "./dragDropFill";

describe("nối cụm nhiều từ vào một ô", () => {
  const run = (text: string, opts: ReturnType<typeof mk>[], word: string, nth = 0) => {
    const { answers, distractors } = split(opts);
    const tokens = tokenize(text);
    let idx = -1;
    let seen = 0;
    tokens.forEach((t, i) => {
      if (t.kind === "word" && t.core === word && seen++ === nth) idx = i;
    });
    return blankifyAt(tokens, idx, answers, distractors)!;
  };

  it("từ kề sau ô thì nối vào cuối đáp án", () => {
    const r = run("Đội có [[1]] cầu thủ", [mk("11", 1)], "cầu");
    expect(r.prompt).toBe("Đội có [[1]] thủ");
    expect(r.options[0]!.label).toBe("11 cầu");
  });

  it("từ kề trước ô thì nối vào đầu đáp án", () => {
    const r = run("Đội có 11 [[1]]", [mk("cầu thủ", 1)], "11");
    expect(r.prompt).toBe("Đội có [[1]]");
    expect(r.options[0]!.label).toBe("11 cầu thủ");
  });

  it("từ không kề ô thì vẫn tạo ô mới, số đánh lại theo thứ tự", () => {
    const r = run("Đội có [[1]] cầu thủ ra sân", [mk("11", 1)], "sân");
    expect(r.prompt).toBe("Đội có [[1]] cầu thủ ra [[2]]");
  });

  it("dấu câu chắn giữa thì không gộp", () => {
    const r = run("Có [[1]], hiệp", [mk("2", 1)], "hiệp");
    expect(r.prompt).toBe("Có [[1]], [[2]]");
  });
});
