import { describe, expect, it } from "vitest";
import {
  blockSummary,
  blockToPlainLines,
  newBlockItemId,
  parseDialoguePaste,
  parseVocabPaste,
  splitDuplicateTerms,
} from "@/lib/langBlocks";

/**
 * LANG G2 / G2.2 — nhập hàng loạt bằng cách dán bảng, nhận biết trùng, tóm tắt
 * trên dòng danh sách, và bản chữ cho trang in. Toàn bộ là hàm thuần.
 */

describe("parseVocabPaste — dán từ Excel/Google Sheets (cột cách nhau bằng tab)", () => {
  it("G2.2.2: 2 cột = từ · nghĩa; 3 cột = từ · phiên âm · nghĩa; 4 cột thêm ví dụ", () => {
    const r = parseVocabPaste(
      ["你好\txin chào", "朋友\tpéngyou\tbạn bè", "谢谢\txièxie\tcảm ơn\t谢谢你的帮助。"].join("\n"),
    );
    expect(r.errors).toEqual([]);
    expect(r.items).toEqual([
      { term: "你好", meaning: "xin chào" },
      { term: "朋友", reading: "péngyou", meaning: "bạn bè" },
      { term: "谢谢", reading: "xièxie", meaning: "cảm ơn", example: "谢谢你的帮助。" },
    ]);
  });

  it("G2.2.2: dạng `từ | phiên âm | nghĩa | ví dụ` khi không có tab", () => {
    const r = parseVocabPaste("你好 | nǐ hǎo | xin chào\n再见 | zàijiàn | tạm biệt | 明天见！");
    expect(r.errors).toEqual([]);
    expect(r.items[0]).toEqual({ term: "你好", reading: "nǐ hǎo", meaning: "xin chào" });
    expect(r.items[1]).toEqual({ term: "再见", reading: "zàijiàn", meaning: "tạm biệt", example: "明天见！" });
  });

  it("có tab thì tab thắng: dấu | trong ô là chữ bình thường", () => {
    const r = parseVocabPaste("a | b\tnghĩa có | trong đó");
    expect(r.items).toEqual([{ term: "a | b", meaning: "nghĩa có | trong đó" }]);
  });

  it("bỏ dòng trống và cắt khoảng trắng đầu/cuối ô; số dòng lỗi tính theo dòng gốc", () => {
    const r = parseVocabPaste("  你好 \t xin chào  \n\n\n\t\n坏dòng\n好\ttốt");
    expect(r.items).toEqual([{ term: "你好", meaning: "xin chào" }, { term: "好", meaning: "tốt" }]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ line: 5 });
  });

  it("G2.2.2: dòng lỗi được liệt kê theo số dòng và KHÔNG chặn các dòng đúng", () => {
    const r = parseVocabPaste(
      ["ok1\tnghĩa 1", "chỉ-một-cột", "\tthiếu từ", "thiếu nghĩa\t", "a\tb\tc\td\te\tf", "ok2\tnghĩa 2"].join("\n"),
    );
    expect(r.items.map((i) => i.term)).toEqual(["ok1", "ok2"]);
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 4, 5]);
    for (const e of r.errors) expect(e.reason.length).toBeGreaterThan(0);
  });

  it("trường quá dài bị báo lỗi theo giới hạn của schema (term ≤ 200, nghĩa ≤ 500)", () => {
    const r = parseVocabPaste(`${"x".repeat(201)}\tnghĩa\n${"y".repeat(5)}\t${"z".repeat(501)}\nok\tok`);
    expect(r.errors.map((e) => e.line)).toEqual([1, 2]);
    expect(r.items).toEqual([{ term: "ok", meaning: "ok" }]);
  });

  it("vượt 300 dòng: nhận 300 dòng đầu, các dòng sau báo lỗi", () => {
    const text = Array.from({ length: 305 }, (_, i) => `t${i}\tm${i}`).join("\n");
    const r = parseVocabPaste(text);
    expect(r.items).toHaveLength(300);
    expect(r.errors).toHaveLength(5);
    expect(r.errors[0]!.line).toBe(301);
  });

  it("G2.2.3: dán 50 dòng hợp lệ → đúng 50 dòng", () => {
    const text = Array.from({ length: 50 }, (_, i) => `từ${i}\tnghĩa${i}`).join("\n");
    const r = parseVocabPaste(text);
    expect(r.items).toHaveLength(50);
    expect(r.errors).toEqual([]);
  });

  it("chuỗi rỗng: không có gì để nhập, không lỗi", () => {
    expect(parseVocabPaste("")).toEqual({ items: [], errors: [] });
    expect(parseVocabPaste("  \n \n")).toEqual({ items: [], errors: [] });
  });

  it("chấp nhận cả xuống dòng kiểu Windows (CRLF)", () => {
    const r = parseVocabPaste("a\tb\r\nc\td\r\n");
    expect(r.items).toEqual([{ term: "a", meaning: "b" }, { term: "c", meaning: "d" }]);
  });
});

describe("splitDuplicateTerms — G2.2.3", () => {
  it("tách dòng mới và dòng đã có (so theo từ, bỏ khác biệt hoa-thường và khoảng trắng)", () => {
    const existing = [{ term: "你好" }, { term: "Hello" }];
    const incoming = [{ term: " 你好 " }, { term: "hello" }, { term: "再见" }];
    const { fresh, duplicates } = splitDuplicateTerms(existing, incoming);
    expect(fresh.map((i) => i.term)).toEqual(["再见"]);
    expect(duplicates.map((i) => i.term.trim())).toEqual(["你好", "hello"]);
  });

  it("trùng ngay trong lượt dán: dòng sau coi là trùng dòng trước", () => {
    const { fresh, duplicates } = splitDuplicateTerms([], [{ term: "a" }, { term: "b" }, { term: "a" }]);
    expect(fresh.map((i) => i.term)).toEqual(["a", "b"]);
    expect(duplicates).toHaveLength(1);
  });

  it("so sánh theo Unicode chuẩn hoá (é dựng sẵn = e + dấu rời)", () => {
    const { duplicates } = splitDuplicateTerms([{ term: "café" }], [{ term: "café" }]);
    expect(duplicates).toHaveLength(1);
  });
});

describe("parseDialoguePaste — G2.2.4", () => {
  it("tách người nói và lời ở dấu hai chấm đầu tiên (dấu `：` toàn góc hoặc `:`)", () => {
    const r = parseDialoguePaste("A：你好！\nB: 你好，好久不见。\nA：最近忙吗？");
    expect(r.errors).toEqual([]);
    expect(r.turns).toEqual([
      { speaker: "A", text: "你好！" },
      { speaker: "B", text: "你好，好久不见。" },
      { speaker: "A", text: "最近忙吗？" },
    ]);
  });

  it("chỉ tách ở dấu hai chấm ĐẦU TIÊN: lời có dấu hai chấm vẫn giữ nguyên", () => {
    const r = parseDialoguePaste("Cô giáo: Bây giờ là 10:30 rồi");
    expect(r.turns).toEqual([{ speaker: "Cô giáo", text: "Bây giờ là 10:30 rồi" }]);
  });

  it("dòng thiếu người nói, thiếu lời, hoặc người nói quá 40 ký tự bị báo lỗi theo số dòng; dòng đúng vẫn nhận", () => {
    const r = parseDialoguePaste(["A：ok", "không có dấu hai chấm", "B：", "：thiếu người nói", `${"x".repeat(41)}：quá dài`, "A：ok 2"].join("\n"));
    expect(r.turns.map((t) => t.text)).toEqual(["ok", "ok 2"]);
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 4, 5]);
  });

  it("quá 100 lượt: nhận 100 lượt đầu, phần sau báo lỗi", () => {
    const r = parseDialoguePaste(Array.from({ length: 103 }, (_, i) => `A：câu ${i}`).join("\n"));
    expect(r.turns).toHaveLength(100);
    expect(r.errors).toHaveLength(3);
  });

  it("bỏ dòng trống; rỗng thì không lỗi", () => {
    expect(parseDialoguePaste("\n\nA：x\n\n").turns).toHaveLength(1);
    expect(parseDialoguePaste("")).toEqual({ turns: [], errors: [] });
  });
});

describe("blockSummary — G2.2.5", () => {
  it("vocab_list → 'N từ'; dialogue → 'N lượt'; loại khác → null", () => {
    expect(blockSummary("vocab_list", { items: [{}, {}, {}] })).toBe("3 từ");
    expect(blockSummary("dialogue", { turns: [{}, {}] })).toBe("2 lượt");
    expect(blockSummary("video", { url: "x" })).toBeNull();
  });

  it("payload hỏng không làm danh sách sập", () => {
    expect(blockSummary("vocab_list", null)).toBe("0 từ");
    expect(blockSummary("dialogue", { turns: "sai" })).toBe("0 lượt");
  });
});

describe("blockToPlainLines — G2.4.3 (trang in)", () => {
  it("vocab_list: mỗi từ một dòng 'từ (phiên âm) — nghĩa', ví dụ ở dòng thụt vào; không có nút/audio", () => {
    const lines = blockToPlainLines("vocab_list", {
      title: "Từ mới bài 5",
      items: [
        { term: "朋友", reading: "péngyou", meaning: "bạn bè", example: "他是我的朋友。", exampleMeaning: "Anh ấy là bạn tôi.", audioUrl: "/x.mp3" },
        { term: "你好", meaning: "xin chào" },
      ],
    });
    expect(lines[0]).toBe("Từ mới bài 5");
    expect(lines).toContain("朋友 (péngyou) — bạn bè");
    expect(lines).toContain("你好 — xin chào");
    expect(lines.join("\n")).toContain("他是我的朋友。");
    expect(lines.join("\n")).not.toContain("/x.mp3");
  });

  it("dialogue: 'Người nói: lời', kèm phiên âm và bản dịch khi có", () => {
    const lines = blockToPlainLines("dialogue", {
      turns: [{ speaker: "A", text: "你好！", reading: "Nǐ hǎo!", translation: "Xin chào!" }, { speaker: "B", text: "再见" }],
    });
    expect(lines).toContain("A: 你好！");
    expect(lines.join("\n")).toContain("Nǐ hǎo!");
    expect(lines.join("\n")).toContain("Xin chào!");
    expect(lines).toContain("B: 再见");
  });

  it("loại khác hoặc payload hỏng → mảng rỗng, không ném lỗi", () => {
    expect(blockToPlainLines("video", { url: "x" })).toEqual([]);
    expect(blockToPlainLines("vocab_list", null)).toEqual([]);
  });
});

describe("newBlockItemId", () => {
  it("sinh uuid khác nhau mỗi lần (id ổn định cho dòng mới thêm trong form)", () => {
    const a = newBlockItemId();
    const b = newBlockItemId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(a).not.toBe(b);
  });
});
