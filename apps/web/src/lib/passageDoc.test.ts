// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { plainTextToTiptap } from "@/app/instructor/courses/[id]/exams/[examId]/contentHelpers";
import { findUnsupported, htmlToPassageDoc, passageDocIsEmpty, passageDocToHtml, unsupportedLabels } from "./passageDoc";

// docs/tieu-chi/exam-loai-cau-va-dan-anh-doan-van.md — mục D: soạn Đoạn văn bằng trình soạn giàu định dạng.

const texts = (doc: unknown): string[] => {
  const out: string[] = [];
  const walk = (n: unknown) => {
    const node = n as { text?: string; content?: unknown[] };
    if (typeof node.text === "string") out.push(node.text);
    node.content?.forEach(walk);
  };
  walk(doc);
  return out;
};
const nodesOf = (doc: { content: unknown[] }, type: string) => doc.content.filter((n) => (n as { type: string }).type === type) as Array<{ attrs: Record<string, string> }>;

describe("đoạn cũ (chỉ chữ, ảnh, audio, video) qua trình soạn không đổi", () => {
  const OLD = [
    "Đoạn một có chữ.",
    "![Con mèo](/api/exam-assets/a.png)",
    "[[audio:/api/exam-assets/b.mp3|Bài nghe]]",
    "[[video:https://youtu.be/xyz|Video bài giảng]]",
    "Đoạn cuối.",
  ].join("\n\n");

  it("mở rồi lưu lại: chữ giữ nguyên, ảnh/audio/video giữ đúng đường dẫn và mô tả, đúng thứ tự", () => {
    const original = plainTextToTiptap(OLD);
    const again = htmlToPassageDoc(passageDocToHtml(original));
    expect(texts(again)).toEqual(texts(original));
    expect(again.content.map((n) => (n as { type: string }).type)).toEqual(original.content.map((n) => (n as { type: string }).type));
    expect(nodesOf(again, "image")[0]!.attrs).toMatchObject({ src: "/api/exam-assets/a.png", alt: "Con mèo" });
    expect(nodesOf(again, "audio")[0]!.attrs).toEqual({ src: "/api/exam-assets/b.mp3", alt: "Bài nghe" });
    expect(nodesOf(again, "video")[0]!.attrs).toEqual({ src: "https://youtu.be/xyz", alt: "Video bài giảng" });
  });

  it("đoạn cũ không có nút lạ → soạn được, không báo mất", () => {
    expect(findUnsupported(plainTextToTiptap(OLD))).toEqual([]);
  });
});

describe("định dạng mới của trình soạn", () => {
  it("tiêu đề, danh sách chấm/số, chữ đậm/nghiêng/gạch chân/tô nổi đi qua HTML và về lại JSON", () => {
    const html =
      "<h2>Tiêu đề</h2><p>Chữ <strong>đậm</strong>, <em>nghiêng</em>, <u>gạch chân</u>, <mark>tô nổi</mark>.</p>" +
      "<ul><li><p>Một</p></li><li><p>Hai</p></li></ul><ol><li><p>Số một</p></li></ol>";
    const doc = htmlToPassageDoc(html);
    const types = doc.content.map((n) => (n as { type: string }).type);
    expect(types).toEqual(["heading", "paragraph", "bulletList", "orderedList"]);
    expect(findUnsupported(doc)).toEqual([]);
    const marks = JSON.stringify(doc);
    for (const m of ["bold", "italic", "underline", "highlight"]) expect(marks).toContain(`"${m}"`);
    // và đọc lại được thành HTML của ô soạn
    expect(passageDocToHtml(doc)).toContain("<h2>Tiêu đề</h2>");
  });

  it("khối audio và video trong HTML của ô soạn thành nút audio/video đúng thuộc tính", () => {
    const doc = htmlToPassageDoc(
      '<p>Trước</p><div data-passage-media="audio" data-src="/a.mp3" data-alt="Nghe 1">x</div><div data-passage-media="video" data-src="https://youtu.be/q" data-alt="Xem">x</div>',
    );
    expect(nodesOf(doc, "audio")[0]!.attrs).toEqual({ src: "/a.mp3", alt: "Nghe 1" });
    expect(nodesOf(doc, "video")[0]!.attrs).toEqual({ src: "https://youtu.be/q", alt: "Xem" });
  });

  it("thứ không có trong tập (liên kết, màu chữ, bảng, gạch ngang) bị bỏ, chữ vẫn còn", () => {
    const doc = htmlToPassageDoc(
      '<p>Xem <a href="https://x.vn">liên kết</a> và <span style="color: red">đỏ</span> và <s>gạch ngang</s>.</p>' +
        "<table><tbody><tr><td>ô một</td></tr></tbody></table><blockquote><p>trích dẫn</p></blockquote>",
    );
    expect(findUnsupported(doc)).toEqual([]);
    const all = texts(doc).join(" ");
    for (const w of ["liên kết", "đỏ", "gạch ngang", "ô một", "trích dẫn"]) expect(all).toContain(w);
    expect(JSON.stringify(doc)).not.toMatch(/"link"|"textStyle"|"table"|"strike"|"blockquote"/);
  });
});

describe("cỡ chữ của đoạn chữ được chọn", () => {
  const sized = (size: string) => `<p>Chữ thường <span style="font-size: ${size}">chữ to</span> rồi hết.</p>`;
  const sizeOf = (doc: { content: unknown[] }) => {
    const marks: Array<{ type: string; attrs?: { fontSize?: string } }> = [];
    const walk = (n: unknown) => {
      const node = n as { marks?: typeof marks; content?: unknown[] };
      node.marks?.forEach((m) => marks.push(m));
      node.content?.forEach(walk);
    };
    walk(doc);
    return marks.filter((m) => m.type === "textStyle").map((m) => m.attrs?.fontSize);
  };

  it("ba mức Nhỏ/Lớn/Rất lớn đi qua HTML ↔ JSON và về lại giữ nguyên", () => {
    for (const size of ["0.875rem", "1.25rem", "1.5rem"]) {
      const doc = htmlToPassageDoc(sized(size));
      expect(sizeOf(doc), size).toEqual([size]);
      expect(htmlToPassageDoc(passageDocToHtml(doc))).toEqual(doc);
      expect(findUnsupported(doc)).toEqual([]);
    }
  });

  it("cỡ ngoài bốn mức (dán từ Word: 12pt, 14px…) bị bỏ, chữ vẫn còn", () => {
    for (const size of ["12pt", "14px", "3em", "999rem"]) {
      const doc = htmlToPassageDoc(sized(size));
      expect(sizeOf(doc), size).toEqual([]);
      expect(texts(doc).join("")).toContain("chữ to");
    }
  });
});

describe("màu chữ và màu tô nổi", () => {
  const marksOf = (doc: unknown) => {
    const out: Array<{ type: string; attrs?: Record<string, string> }> = [];
    const walk = (n: unknown) => {
      const node = n as { marks?: typeof out; content?: unknown[] };
      node.marks?.forEach((m) => out.push(m));
      node.content?.forEach(walk);
    };
    walk(doc);
    return out;
  };

  it("màu chữ trong bảng đi qua HTML ↔ JSON, lưu dạng #rrggbb", () => {
    const doc = htmlToPassageDoc('<p>x <span style="color: #dc2626">đỏ</span> y</p>');
    expect(marksOf(doc).filter((m) => m.type === "textStyle")).toEqual([{ type: "textStyle", attrs: { color: "#dc2626" } }]);
    expect(htmlToPassageDoc(passageDocToHtml(doc))).toEqual(doc);
    expect(findUnsupported(doc)).toEqual([]);
  });

  it("màu chữ ngoài bảng (màu tên, hex tuỳ ý) bị bỏ, chữ vẫn còn", () => {
    for (const color of ["red", "#123456", "rgb(1, 2, 3)"]) {
      const doc = htmlToPassageDoc(`<p><span style="color: ${color}">chữ</span></p>`);
      expect(marksOf(doc).filter((m) => m.type === "textStyle"), color).toEqual([]);
      expect(texts(doc)).toContain("chữ");
    }
  });

  it("màu tô nổi trong bảng được giữ; màu lạ rơi về tô nổi mặc định (vẫn tô)", () => {
    const keep = htmlToPassageDoc('<p><mark data-color="#bfdbfe" style="background-color: #bfdbfe">xanh</mark></p>');
    expect(marksOf(keep).find((m) => m.type === "highlight")).toEqual({ type: "highlight", attrs: { color: "#bfdbfe" } });
    const odd = htmlToPassageDoc('<p><mark data-color="#123456" style="background-color: #123456">lạ</mark></p>');
    expect(marksOf(odd).find((m) => m.type === "highlight")).toEqual({ type: "highlight" });
  });

  it("cỡ chữ và màu chữ cùng một đoạn chữ không làm mất nhau", () => {
    const doc = htmlToPassageDoc('<p><span style="font-size: 1.25rem; color: #2563eb">to và xanh</span></p>');
    expect(marksOf(doc).find((m) => m.type === "textStyle")).toEqual({ type: "textStyle", attrs: { fontSize: "1.25rem", color: "#2563eb" } });
  });
});

describe("findUnsupported", () => {
  it("báo nút và dấu ngoài tập mà PassageView vẽ được", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "a", marks: [{ type: "link", attrs: { href: "x" } }] }] },
        { type: "table", content: [] },
        { type: "blockquote", content: [] },
      ],
    };
    expect(findUnsupported(doc).sort()).toEqual(["blockquote", "dấu link", "table"]);
  });
  it("tài liệu rỗng hoặc hỏng không làm sập", () => {
    expect(findUnsupported(null)).toEqual([]);
    expect(findUnsupported({ type: "doc" })).toEqual([]);
  });
});

describe("unsupportedLabels", () => {
  it("đổi tên kỹ thuật sang tiếng Việt, gộp trùng; phần lạ giữ nguyên tên", () => {
    expect(unsupportedLabels(["table", "tableRow", "tableCell", "dấu link", "figure", "lạLắm"]).sort()).toEqual(["bảng", "liên kết", "lạLắm", "ảnh có chú thích"].sort());
  });
});

describe("passageDocIsEmpty", () => {
  it("chỉ coi là rỗng khi không có chữ, ảnh, audio, video", () => {
    expect(passageDocIsEmpty({ type: "doc", content: [{ type: "paragraph" }] })).toBe(true);
    expect(passageDocIsEmpty({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "  " }] }] })).toBe(true);
    expect(passageDocIsEmpty({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] })).toBe(false);
    expect(passageDocIsEmpty({ type: "doc", content: [{ type: "audio", attrs: { src: "/a" } }] })).toBe(false);
  });
});
