import { describe, expect, it } from "vitest";
import { buildPptx, SLIDE_H as H, SLIDE_W as W } from "@/test/pptxFixture";
import { parsePptx } from "./pptxImport";
import { joinWrappedLines } from "./pptxLayout";

/**
 * Slide không dùng placeholder (mọi chữ trong hộp chữ, nhóm hình): tiêu chí P35–P42, docs/tieu-chi/nhap-powerpoint.md.
 * Các slide mẫu mô phỏng hai file thật đã thử (BL_ED2000_0103…, báo cáo ED2).
 */
const read = async (slides: Parameters<typeof buildPptx>[0]) => (await parsePptx(await buildPptx(slides))).deck.slides;
const y = (f: number) => Math.round(f * H);
const x = (f: number) => Math.round(f * W);
const texts = (ps: Array<{ text: string; level: number }>) => ps.map((p) => `${"  ".repeat(p.level)}${p.text}`);

describe("P36, P38: tiêu đề theo cỡ chữ, dòng dẫn phía trên tiêu đề", () => {
  it("bìa: tên học phần 54 pt là tiêu đề, dòng nhỏ phía trên là dòng dẫn", async () => {
    const [s] = await read([
      {
        layout: "blank",
        textBoxes: [
          { text: "Nhóm chuyên môn: Công nghệ giáo dục", y: y(0.37), cy: y(0.04), sz: 24 },
          { text: "NHẬP MÔN CÔNG NGHỆ GIÁO DỤC", y: y(0.45), cy: y(0.056), sz: 54, b: true },
          { text: "Định nghĩa và phạm vi công nghệ giáo dục", y: y(0.52), cy: y(0.048), sz: 32, b: true },
        ],
      },
    ]);
    expect(s!.title).toBe("NHẬP MÔN CÔNG NGHỆ GIÁO DỤC");
    expect(s!.kicker).toBe("Nhóm chuyên môn: Công nghệ giáo dục");
    expect(texts(s!.paragraphs)).toEqual(["Định nghĩa và phạm vi công nghệ giáo dục"]);
  });

  it("P35, P41: tiêu đề nằm trong nhóm hình ở đầu slide thắng các mục chữ to hơn ở giữa; dòng ngắt được ghép", async () => {
    const [s] = await read([
      {
        layout: "blank",
        // Toạ độ con lệch xa: không đổi theo chOff/chExt thì tiêu đề tưởng như ở đáy slide.
        groups: [{ off: [x(0.03), y(0.08)], ext: [x(0.4), y(0.08)], chOff: [5_000_000, 5_000_000], chExt: [x(0.4), y(0.08)], boxes: [{ text: "NỘI DUNG BÀI HỌC", x: 5_000_000, y: 5_000_000, cx: x(0.4), cy: y(0.08), sz: 36, b: true }] }],
        textBoxes: [
          { paras: ["ĐỊNH NGHĨA", "VỀ CÔNG NGHỆ GIÁO DỤC"], x: x(0.5), y: y(0.34), cy: y(0.12), sz: 40, b: true },
          { text: "01", x: x(0.45), y: y(0.27), cx: x(0.04), cy: y(0.07), sz: 40, b: true },
          { paras: ["PHẠM VI CỦA", "CÔNG NGHỆ GIÁO DỤC"], x: x(0.5), y: y(0.59), cy: y(0.12), sz: 40, b: true },
          { text: "02", x: x(0.45), y: y(0.52), cx: x(0.04), cy: y(0.07), sz: 40, b: true },
        ],
      },
    ]);
    expect(s!.title).toBe("NỘI DUNG BÀI HỌC");
    expect(texts(s!.paragraphs)).toEqual(["ĐỊNH NGHĨA VỀ CÔNG NGHỆ GIÁO DỤC", "PHẠM VI CỦA CÔNG NGHỆ GIÁO DỤC"]);
  });

  it("P37–P40: tiêu đề ngắt hai khối được ghép; 'NỘI DUNG 1' là dòng dẫn; dòng nguồn hình và số trang tách riêng", async () => {
    const [s] = await read([
      {
        layout: "blank",
        textBoxes: [
          { text: "NỘI DUNG 1", y: y(0.16), cy: y(0.058), sz: 34.66, b: true },
          { text: "ĐỊNH NGHĨA VỀ", y: y(0.395), cy: y(0.064), sz: 45.6, b: true },
          { text: "CÔNG NGHỆ GIÁO DỤC", y: y(0.465), cy: y(0.1), sz: 72, b: true },
          { text: "Nguồn ảnh minh hoạ: Tạo bởi Claude (AI)", x: x(0.59), y: y(0.89), cy: y(0.024), sz: 16 },
          { text: "4", x: x(0.88), y: y(0.94), cx: x(0.1), cy: y(0.05), sz: 20, b: true },
        ],
      },
    ]);
    expect(s!.title).toBe("ĐỊNH NGHĨA VỀ CÔNG NGHỆ GIÁO DỤC");
    expect(s!.kicker).toBe("NỘI DUNG 1");
    expect(s!.credit).toBe("Nguồn ảnh minh hoạ: Tạo bởi Claude (AI)");
    expect(s!.paragraphs).toEqual([]);
  });

  it("P39: ký tự biểu tượng ('z') và số trang ('1') không bao giờ thành tiêu đề hay ý", async () => {
    const [s] = await read([
      {
        layout: "blank",
        textBoxes: [
          { text: "z", y: -500000, geom: "roundRect" },
          { text: "1", x: x(0.9), y: y(0.93), cx: x(0.05), cy: y(0.04), sz: 28, b: true },
          { text: "MỤC TIÊU BÀI HỌC", y: y(0.12), cy: y(0.06), sz: 40, b: true },
          { text: "Sau bài học, sinh viên có thể:", y: y(0.23), cy: y(0.045), sz: 30 },
          { paras: [{ text: "Giải thích được khái niệm công nghệ.", num: true }, { text: "Phân biệt được hai cách hiểu.", num: true }], y: y(0.3), cy: y(0.5), sz: 32 },
        ],
      },
    ]);
    expect(s!.title).toBe("MỤC TIÊU BÀI HỌC");
    expect(texts(s!.paragraphs)).toEqual(["Sau bài học, sinh viên có thể:", "Giải thích được khái niệm công nghệ.", "Phân biệt được hai cách hiểu."]);
  });
});

describe("P42: nhãn và nội dung của nhãn", () => {
  it("nhãn ở cột trái, nội dung bên phải cùng hàng → bảng hai cột (không hàng tiêu đề)", async () => {
    const [s] = await read([
      {
        layout: "blank",
        textBoxes: [
          { text: "2.1. TECHNOLOGY IN EDUCATION", y: y(0.13), cy: y(0.08), sz: 50, b: true },
          { text: "Bản chất", x: x(0.04), y: y(0.44), cx: x(0.1), cy: y(0.036), sz: 27, b: true },
          { paras: [{ text: "Ứng dụng công nghệ như công cụ hỗ trợ giảng dạy", bu: true }], x: x(0.17), y: y(0.43), cx: x(0.44), cy: y(0.072), sz: 28 },
          { text: "Đặc trưng", x: x(0.04), y: y(0.66), cx: x(0.1), cy: y(0.036), sz: 27, b: true },
          { paras: ["Tập trung vào phương tiện", "Không thay đổi bản chất phương pháp dạy học"].map((t) => ({ text: t, bu: true })), x: x(0.17), y: y(0.63), cx: x(0.43), cy: y(0.145), sz: 28 },
        ],
      },
    ]);
    expect(s!.tables).toEqual([
      [
        ["", ""],
        ["Bản chất", "Ứng dụng công nghệ như công cụ hỗ trợ giảng dạy"],
        ["Đặc trưng", "Tập trung vào phương tiện; Không thay đổi bản chất phương pháp dạy học"],
      ],
    ]);
    expect(s!.paragraphs).toEqual([]);
  });

  it("nhãn chung 'Ví dụ' giữa các nhãn cùng cỡ chữ → ý có các ý con", async () => {
    const [s] = await read([
      {
        layout: "blank",
        textBoxes: [
          { text: "1.2. ĐỊNH NGHĨA CÔNG NGHỆ GIÁO DỤC", y: y(0.13), cy: y(0.08), sz: 50, b: true },
          { text: "Công nghệ giáo dục là việc ứng dụng công nghệ và phương pháp hiện đại để cải thiện hiệu quả dạy và học.", y: y(0.24), cy: y(0.08), sz: 28, b: true },
          { text: "Ví dụ", x: x(0.08), y: y(0.48), cx: x(0.05), cy: y(0.036), sz: 27, b: true },
          { text: "Thực tế ảo (VR, AR)", x: x(0.25), y: y(0.48), cx: x(0.29), cy: y(0.032), sz: 27, b: true },
          { text: "Công cụ đa phương tiện", x: x(0.73), y: y(0.48), cx: x(0.25), cy: y(0.032), sz: 27, b: true },
          { text: "Học trực tuyến (e-learning)", x: x(0.03), y: y(0.75), cx: x(0.16), cy: y(0.062), sz: 27, b: true },
        ],
      },
    ]);
    expect(texts(s!.paragraphs)).toEqual([
      "Công nghệ giáo dục là việc ứng dụng công nghệ và phương pháp hiện đại để cải thiện hiệu quả dạy và học.",
      "Ví dụ",
      "  Thực tế ảo (VR, AR)",
      "  Công cụ đa phương tiện",
      "  Học trực tuyến (e-learning)",
    ]);
  });

  it("hai hộp cao bằng nhau đặt cạnh nhau, mỗi hộp có tiêu đề đậm và gạch đầu dòng → bảng có hàng tiêu đề", async () => {
    const box = (head: string, items: string[], left: number) => ({
      paras: [{ text: head, b: true }, ...items.map((t) => ({ text: t, bu: true }))],
      x: x(left),
      // Hộp phải cao hơn hộp trái 1 EMU: thứ tự đọc vẫn trái sang phải (dung sai theo hàng).
      y: y(0.16) - (left > 0.4 ? 1 : 0),
      cx: x(0.45),
      cy: y(0.5),
      sz: 24,
      geom: "rect",
    });
    const [s] = await read([
      {
        layout: "blank",
        textBoxes: [
          { text: "1.4 AI thay đổi yêu cầu năng lực", y: y(0.04), cy: y(0.08), sz: 40, b: true },
          box("Năng lực đang mất lợi thế", ["Sản xuất nội dung thông thường", "Thiết kế học liệu theo mẫu"], 0.04),
          box("Năng lực đang gia tăng nhu cầu", ["Sử dụng AI có kiểm soát", "Đánh giá đầu ra của AI"], 0.52),
          { text: "Thị trường lao động đang dịch chuyển rõ rệt.", y: y(0.7), cy: y(0.09), sz: 20 },
        ],
      },
    ]);
    expect(s!.tables).toEqual([
      [
        ["Năng lực đang mất lợi thế", "Năng lực đang gia tăng nhu cầu"],
        ["Sản xuất nội dung thông thường", "Sử dụng AI có kiểm soát"],
        ["Thiết kế học liệu theo mẫu", "Đánh giá đầu ra của AI"],
      ],
    ]);
    expect(texts(s!.paragraphs)).toEqual(["Thị trường lao động đang dịch chuyển rõ rệt."]);
  });

  it("hộp nhỏ 'Pros' cạnh một khối lớn không thành bảng: tiêu đề hộp có các ý con", async () => {
    const [s] = await read([
      {
        layout: "blank",
        textBoxes: [
          { text: "2.1 Phân tích chuẩn đầu ra", y: y(0.03), cy: y(0.08), sz: 40, b: true },
          { paras: [{ text: "Kiến thức chuyên môn", b: true }, { text: "PLO1. Áp dụng kiến thức khoa học.", bu: true, b: true }], x: x(0.03), y: y(0.14), cx: x(0.42), cy: y(0.73), sz: 20 },
          { paras: [{ text: "Pros", b: true }, { text: "Nền tảng kiến thức rộng", bu: true }], x: x(0.49), y: y(0.16), cx: x(0.5), cy: y(0.3), sz: 20, geom: "rect" },
        ],
      },
    ]);
    expect(s!.tables).toEqual([]);
    expect(texts(s!.paragraphs)).toEqual(["Kiến thức chuyên môn", "  PLO1. Áp dụng kiến thức khoa học.", "Pros", "  Nền tảng kiến thức rộng"]);
  });
});

describe("P41: ghép dòng ngắt trong một khối", () => {
  const P = (text: string, o: Partial<{ bullet: boolean; size: number }> = {}) => ({ text, level: 0, numbered: false, bullet: false, size: 40, bold: true, ...o });
  it("ghép khi cả hai viết hoa hoặc dòng dưới bắt đầu bằng chữ thường; không ghép mục có gạch đầu dòng hay câu đã kết", () => {
    expect(joinWrappedLines([P("ĐỊNH NGHĨA"), P("VỀ CÔNG NGHỆ")]).map((p) => p.text)).toEqual(["ĐỊNH NGHĨA VỀ CÔNG NGHỆ"]);
    expect(joinWrappedLines([P("quy luật khách quan,"), P("tác động vào đối tượng")]).map((p) => p.text)).toEqual(["quy luật khách quan, tác động vào đối tượng"]);
    expect(joinWrappedLines([P("Thực tế ảo", { bullet: true }), P("công cụ", { bullet: true })]).length).toBe(2);
    expect(joinWrappedLines([P("Câu đã kết."), P("tiếp theo")]).length).toBe(2);
    expect(joinWrappedLines([P("Thực tế ảo (VR, AR)"), P("Công cụ đa phương tiện")]).length).toBe(2);
  });
});

describe("file Positive Thinking (P49–P50)", () => {
  it("P49: tiêu đề là hộp 'Title 2' không ghi cỡ chữ; chú thích 'Figure 1b' không bao giờ là tiêu đề; 'Source:' là nguồn", async () => {
    const [s] = await read([
      {
        layout: "blank",
        textBoxes: [
          { text: "1. POSITIVE THINKING", y: 0, cy: y(0.1), name: "Title 2" },
          { paras: ["Is the glass half-full or half-empty?", "People say the glass is half-full."].map((t) => ({ text: t, bu: true })), y: y(0.18), cy: y(0.7), sz: 24 },
          { text: "Figure 1b: Glass of water", x: x(0.71), y: y(0.79), cy: y(0.05), sz: 16 },
          { text: "Source: https://www.freepik.com/free-vector/full-empty-glass.htm", x: x(0.63), y: y(0.92), cy: y(0.06), sz: 12 },
        ],
      },
    ]);
    expect(s!.title).toBe("1. POSITIVE THINKING");
    expect(s!.caption).toBe("Figure 1b: Glass of water");
    expect(s!.credit).toBe("Source: https://www.freepik.com/free-vector/full-empty-glass.htm");
    expect(texts(s!.paragraphs)).toEqual(["Is the glass half-full or half-empty?", "People say the glass is half-full."]);
  });

  it("P49: bìa có nhiều hộp cùng tên 'Title 6' → tiêu đề là hộp chữ lớn nhất, hộp nhỏ phía trên là dòng dẫn", async () => {
    const [s] = await read([
      {
        layout: "blank",
        textBoxes: [
          { text: "Faculty of Education", y: y(0.25), cy: y(0.06), sz: 20, name: "Title 6" },
          { text: "SOFT SKILLS", y: y(0.32), cy: y(0.12), sz: 54, b: true, name: "Title 6" },
          { text: "Positive Thinking", y: y(0.45), cy: y(0.12), sz: 26, name: "Title 6" },
        ],
      },
    ]);
    expect([s!.title, s!.kicker, texts(s!.paragraphs)]).toEqual(["SOFT SKILLS", "Faculty of Education", ["Positive Thinking"]]);
  });

  it("P50: dòng đậm không gạch đầu dòng là ý cha của các gạch đầu dòng ngay sau nó", async () => {
    const [s] = await read([
      {
        layout: "blank",
        textBoxes: [
          { text: "1. POSITIVE THINKING", y: 0, cy: y(0.1), name: "Title 2" },
          {
            paras: [
              { text: "Why positive thinking matter?", b: true },
              { text: "Research findings:", b: true },
              { text: "Lower stress hormones", bu: true },
              { text: "Better problem solving", bu: true },
            ],
            y: y(0.15),
            cy: y(0.7),
            sz: 24,
          },
        ],
      },
    ]);
    expect(texts(s!.paragraphs)).toEqual(["Why positive thinking matter?", "Research findings:", "  Lower stress hormones", "  Better problem solving"]);
  });
});

describe("P52: chữ được nhấn trong slide gốc", () => {
  it("chữ đổi màu giữa câu là tô màu, đậm hoặc nghiêng một phần câu cũng giữ; cả đoạn đậm thì không", async () => {
    const [s] = await read([
      {
        layout: "blank",
        textBoxes: [
          { text: "3. THE SCIENCE OF HAPPINESS", y: 0, cy: y(0.1), name: "Title 1" },
          {
            paras: [
              { text: "", runs: [{ text: "There are " }, { text: "chemicals", color: "accent2", b: true }, { text: " in our brains." }] },
              { text: "", runs: [{ text: "Release these ‘" }, { text: "feel-good", color: "4A86E8" }, { text: "’ chemicals!" }] },
              { text: "", runs: [{ text: "Học " }, { text: "chủ động", b: true }, { text: " và " }, { text: "có phản hồi", i: true }] },
              { text: "Câu được tô nền vàng", runs: [{ text: "Câu được " }, { text: "tô nền vàng", hl: true }] },
              { text: "Cả đoạn đậm là kiểu của đoạn", b: true },
              { text: "Chữ đen cũng không phải chỗ nhấn", runs: [{ text: "Chữ " }, { text: "đen", color: "000000" }, { text: " cũng không phải chỗ nhấn" }] },
            ],
            y: y(0.2),
            cy: y(0.6),
            sz: 24,
          },
        ],
      },
    ]);
    expect(s!.emphasis).toEqual([
      { text: "chemicals", kind: "mark" },
      { text: "feel-good", kind: "mark" },
      { text: "chủ động", kind: "bold" },
      { text: "có phản hồi", kind: "italic" },
      { text: "tô nền vàng", kind: "mark" },
    ]);
  });

  it("cả câu khác màu với phần còn lại của khối là tô màu (câu trích dẫn đỏ cuối danh sách)", async () => {
    const [s] = await read([
      {
        layout: "blank",
        textBoxes: [
          { text: "2. A POSITIVE ATTITUDE", y: 0, cy: y(0.1), name: "Title 1" },
          {
            paras: [
              { text: "“Every day may not be good, but there is good in every day.”", color: "tx1" },
              { text: "“A positive attitude will lead to positive outcomes.”", color: "tx1" },
              { text: "“Attitude is a little thing.” - Winston Churchill", color: "accent2" },
            ],
            y: y(0.2),
            cy: y(0.6),
            sz: 24,
          },
        ],
      },
    ]);
    expect(s!.emphasis).toEqual([{ text: "“Attitude is a little thing.” - Winston Churchill", kind: "mark" }]);
  });
});

describe("P53: cụm từ khoá rải trên slide, mỗi từ một màu", () => {
  const WORDS: Array<[string, string]> = [
    ["fantastic", "00B3BC"],
    ["laugh", "00B050"],
    ["love", "E17A2A"],
    ["best", "FFC000"],
    ["great", "FFC000"],
    ["enjoy", "E17A2A"],
  ];
  it("nhiều hộp chữ một từ, mỗi hộp một màu, là cụm từ (theo thứ tự đọc), không phải gạch đầu dòng", async () => {
    const [s] = await read([
      {
        layout: "blank",
        textBoxes: [
          { text: "4. REFLECTION", y: 0, cy: y(0.1), name: "Title 1" },
          { paras: [{ text: "Using the words below, compose a positive statement to share with the class.", color: "tx1" }], y: y(0.22), cy: y(0.1), sz: 24 },
          ...WORDS.map(([w, c], i) => ({ paras: [{ text: w, color: c }], x: x(0.2 + 0.2 * (i % 3)), y: y(0.4 + 0.15 * Math.floor(i / 3)), cx: x(0.12), cy: y(0.08), sz: 28 })),
        ],
      },
    ]);
    expect(s!.words).toEqual(["fantastic", "laugh", "love", "best", "great", "enjoy"]);
    expect(texts(s!.paragraphs)).toEqual(["Using the words below, compose a positive statement to share with the class."]);
  });

  it("một khối có các dòng một từ khác màu cạnh gạch đầu dòng cũng là cụm từ", async () => {
    const [s] = await read([
      {
        layout: "blank",
        textBoxes: [
          { text: "3. THE SCIENCE OF HAPPINESS", y: 0, cy: y(0.1), name: "Title 1" },
          { paras: [{ text: "Our brains are in charge of our feelings.", bu: true }, { text: "There are chemicals in our brains.", bu: true }], x: x(0.05), y: y(0.2), cx: x(0.55), cy: y(0.6), sz: 24 },
          { paras: [{ text: "dopamine", color: "00B3BC", i: true }, { text: "oxytocin", color: "75CD90", i: true }, { text: "serotonin", color: "E17A2A", i: true }, { text: "endorphins", color: "FFE36D", i: true }], x: x(0.7), y: y(0.55), cx: x(0.25), cy: y(0.3), sz: 32 },
        ],
      },
    ]);
    expect(s!.words).toEqual(["dopamine", "oxytocin", "serotonin", "endorphins"]);
    expect(texts(s!.paragraphs)).toEqual(["Our brains are in charge of our feelings.", "There are chemicals in our brains."]);
  });

  it("các nhãn ngắn cùng một màu (sơ đồ) hoặc màu chữ thường không phải cụm từ", async () => {
    const [s] = await read([
      {
        layout: "blank",
        textBoxes: [
          { text: "Quy trình", y: 0, cy: y(0.1), name: "Title 1" },
          ...["Đầu vào", "Xử lý", "Đầu ra"].map((w, i) => ({ paras: [{ text: w, color: "1F4E79" }], x: x(0.1 + 0.3 * i), y: y(0.4), cx: x(0.2), cy: y(0.1), sz: 24 })),
        ],
      },
    ]);
    expect(s!.words).toEqual([]);
  });
});

describe("P54: tên tác giả dòng riêng ghép vào câu trích dẫn", () => {
  it("dòng '- Tác giả' ngay sau câu trong ngoặc kép ghép thành một dòng", async () => {
    const [s] = await read([
      {
        layout: "blank",
        textBoxes: [
          { text: "2. A POSITIVE ATTITUDE", y: 0, cy: y(0.1), name: "Title 1" },
          {
            paras: [
              "“Every day may not be good, but there is good in every day.”",
              "- Alice Morse Earle",
              "“We can complain because rose bushes have thorns,",
              "or rejoice because thorn bushes have roses.”",
              "– Abraham Lincoln",
              "“Every cloud has a silver lining.” - John Milton",
            ],
            y: y(0.2),
            cy: y(0.6),
            sz: 24,
          },
        ],
      },
    ]);
    expect(texts(s!.paragraphs)).toEqual([
      "“Every day may not be good, but there is good in every day.” — Alice Morse Earle",
      "“We can complain because rose bushes have thorns, or rejoice because thorn bushes have roses.” — Abraham Lincoln",
      "“Every cloud has a silver lining.” - John Milton",
    ]);
  });
});
