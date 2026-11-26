import { describe, expect, it } from "vitest";
import { buildTeachingFrames, frameAccent, frameSections, passageBlocks, sectionName, type TeachingItem, type TeachingPracticeInput } from "./teachingFrames";

const rich = (id: string, html: string): TeachingItem => ({ id, type: "richtext", payload: { html } });
const dialogue: TeachingItem = {
  id: "d1",
  type: "dialogue",
  payload: {
    title: "课文1A",
    audioUrl: "/a/all.mp3",
    speakers: [{ name: "林雨", avatarUrl: "/img/lv.webp" }, { name: "赵叔叔" }],
    turns: [
      { id: "t1", speaker: "林雨", text: "你好", reading: "Nǐ hǎo", translation: "Xin chào", audioUrl: "/a/1.mp3" },
      { id: "t2", speaker: "赵叔叔", text: "你好！", reading: "Nǐ hǎo!", translation: "Chào cháu" },
      { id: "t3", speaker: "林雨", text: "  " },
    ],
  },
};
const vocab: TeachingItem = {
  id: "v1",
  type: "vocab_list",
  payload: {
    audioUrl: "/a/vocab.mp3",
    items: [
      { id: "a", term: "租", reading: "zū", meaning: "thuê", trackStartSec: 0, example: "我想租房子。" },
      { id: "b", term: "房东", reading: "fángdōng", meaning: "chủ nhà", trackStartSec: 4.5 },
      { id: "c", term: "", meaning: "bỏ" },
    ],
  },
};
const practice: TeachingItem = { id: "p1", type: "exam_practice", payload: { title: "Nhìn hình" } };
const practices: Record<string, TeachingPracticeInput> = {
  p1: {
    title: "Nhìn hình",
    passages: [{ id: "ps1", title: "Tin nhắn", contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "你好" }] }] } }],
    questions: [
      {
        id: "q1",
        type: "mcq",
        prompt: "Hình này là gì?",
        passageId: null,
        config: { options: [{ id: "o1", label: "厕所" }, { id: "o2", label: "厨房" }], promptAid: { reading: "Zhè shì shénme?", translation: "Đây là gì?" } },
      },
      { id: "q2", type: "matching", prompt: "Nối", passageId: "ps1", config: { lefts: [{ id: "x", label: "租" }], rights: [{ id: "y", label: "thuê" }] } },
      { id: "q3", type: "essay", prompt: "Nói về nhà", passageId: "ps1", config: {} },
    ],
  },
};

describe("buildTeachingFrames", () => {
  const frames = buildTeachingFrames({
    lessonTitle: "Bài khoá 1",
    items: [
      rich("r0", '<section aria-label="Mục tiêu bài học"><p>Học xong…</p></section>'),
      rich("r1", '<nav><a href="#a">Mục</a></nav><h2>Tình huống</h2><p>Lâm Vũ thuê nhà.</p>'),
      dialogue,
      vocab,
      practice,
      { id: "n1", type: "teacher_note", payload: { html: "<p>Ghi chú riêng</p>" } },
      { id: "n2", type: "video", payload: { url: "https://x" } },
      { id: "p2", type: "exam_practice", payload: { title: "Chưa có câu" } },
    ],
    practices,
  });
  const kinds = frames.map((f) => f.kind);

  it("thứ tự: bìa → các màn chữ → hội thoại → từ mới → luyện tập; bỏ ghi chú giảng viên, video và khối luyện tập chưa có câu", () => {
    expect(kinds).toEqual([
      "cover", "html", "html", // mục tiêu, tình huống
      "dialogue", "turn", "turn", // hội thoại: một màn cả đoạn + mỗi lượt có chữ một màn (lượt trắng bị bỏ)
      "vocab", "vocab", // từ mới: bỏ dòng không có chữ
      "question", "question", "question", // ba câu luyện tập (bài đọc nằm trong câu, không có màn riêng)
    ]);
    expect(JSON.stringify(frames)).not.toContain("Ghi chú riêng");
    expect(JSON.stringify(frames)).not.toContain("https://x");
  });

  it("mỗi lượt hội thoại một màn, kèm avatar, phiên âm, dịch và số thứ tự", () => {
    const turns = frames.filter((f) => f.kind === "turn");
    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({ speaker: "林雨", avatarUrl: "/img/lv.webp", reading: "Nǐ hǎo", translation: "Xin chào", turnNo: 1, turnTotal: 2, audioUrl: "/a/1.mp3" });
    expect(turns[1]).toMatchObject({ speaker: "赵叔叔", avatarUrl: undefined, turnNo: 2 });
  });

  it("từ mới của bài (từ 2 chữ Hán trở lên) được đưa vào hội thoại để tô nổi bật", () => {
    const withKeys = buildTeachingFrames({
      lessonTitle: "B",
      items: [dialogue, { id: "v", type: "vocab_list", payload: { items: [{ term: "房东", meaning: "x" }, { term: "租", meaning: "y" }] } }],
      practices: {},
    });
    expect(withKeys.find((x) => x.kind === "dialogue")).toMatchObject({ keys: ["房东"] });
    expect(withKeys.find((x) => x.kind === "turn")).toMatchObject({ keys: ["房东"] });
  });

  it("từ mới: mỗi từ một màn; âm thanh gộp phát từ mốc của từ đến mốc của từ kế", () => {
    const v = frames.filter((f) => f.kind === "vocab");
    expect(v[0]).toMatchObject({ term: "租", no: 1, total: 2, track: { url: "/a/vocab.mp3", startSec: 0, endSec: 4.5 } });
    expect(v[1]).toMatchObject({ term: "房东", track: { startSec: 4.5, endSec: undefined } });
  });

  it("câu luyện tập: có chú giải phiên âm/dịch và lựa chọn nhưng KHÔNG có đáp án", () => {
    const q = frames.filter((f) => f.kind === "question");
    expect(q[0]).toMatchObject({ questionId: "q1", no: 1, total: 3, choices: ["厕所", "厨房"], promptReading: "Zhè shì shénme?", promptTranslation: "Đây là gì?" });
    expect(q[1]).toMatchObject({ type: "matching", leftSide: ["租"], choices: ["thuê"] });
    // Câu có bài đọc mang theo đoạn văn để hiện cạnh câu hỏi; câu không thuộc bài đọc thì passage = null.
    expect(q[0]).toMatchObject({ passage: null });
    expect(q[1]).toMatchObject({ passage: { title: "Tin nhắn", blocks: [{ kind: "text", runs: [{ text: "你好" }] }] } });
    expect(q[2]).toMatchObject({ passage: { title: "Tin nhắn" } });
    expect(JSON.stringify(q)).not.toMatch(/isCorrect|acceptedAnswers|expected|explanation/);
  });

  it("frameSections: một dòng cho mỗi mục, hội thoại và từ mới theo tiêu đề đứng trước, mỗi Bài luyện một dòng", () => {
    const f = buildTeachingFrames({
      lessonTitle: "B",
      items: [
        rich("a", "<h2>2对话 A · Hội thoại: xem nhà</h2><p>x</p>"),
        dialogue,
        rich("b", "<h2>3对话 B · Hội thoại: quyết định thuê</h2><p>y</p>"),
        { ...dialogue, id: "d2" },
        rich("c", "<h2>4生词 · Từ mới</h2><p>z</p>"),
        vocab,
        practice,
      ],
      practices,
    });
    expect(frameSections(f).map((x) => x.label)).toEqual(["Mở bài", "Hội thoại A", "Hội thoại B", "Từ mới", "Luyện tập · Nhìn hình"]);
  });

  it("bài không có phần nào: chỉ còn màn bìa, không có màn trống", () => {
    const f = buildTeachingFrames({ lessonTitle: "Trống", items: [rich("e", "<p>&nbsp;</p>"), { id: "e2", type: "dialogue", payload: { turns: [] } }], practices: {} });
    expect(f.map((x) => x.kind)).toEqual(["cover"]);
  });
});

describe("passageBlocks", () => {
  it("lấy chữ (in đậm theo từng đoạn), hình, âm thanh, bảng theo thứ tự; nút lạ bị bỏ nhưng nội dung con vẫn được duyệt", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "王阿姨", marks: [{ type: "bold" }] }, { type: "text", text: "：你好" }] },
        { type: "image", attrs: { src: "/img/a.webp", alt: "Hình" } },
        { type: "audio", attrs: { src: "/api/exam-assets/x.mp3", alt: "1.1" } },
        { type: "table", content: [{ type: "tableRow", content: [{ type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Từ" }] }] }, { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "租" }] }] }] }] },
        { type: "mystery", content: [{ type: "paragraph", content: [{ type: "text", text: "lồng" }] }] },
      ],
    };
    expect(passageBlocks(doc)).toEqual([
      { kind: "text", runs: [{ text: "王阿姨", bold: true }, { text: "：你好" }] },
      { kind: "image", url: "/img/a.webp", alt: "Hình" },
      { kind: "audio", url: "/api/exam-assets/x.mp3", label: "1.1" },
      { kind: "table", rows: [[{ text: "Từ", head: true }, { text: "租" }]] },
      { kind: "text", runs: [{ text: "lồng" }] },
    ]);
  });
});

describe("câu hỏi có hội thoại đóng vai, nói tự do", () => {
  const f = buildTeachingFrames({
    lessonTitle: "B",
    items: [{ id: "p1", type: "exam_practice", payload: {} }],
    practices: {
      p1: {
        title: "Nói",
        passages: [],
        questions: [
          {
            id: "r1",
            type: "essay",
            prompt: "Đóng vai",
            passageId: null,
            config: {
              roleplay: {
                roles: { A: "教练", B: "方强" },
                turns: [
                  { speaker: "A", text: "你好！ Nǐ hǎo!", audio: "/api/exam-assets/a1.mp3" },
                  { speaker: "B", text: "我刚病好。 Wǒ gāng bìng hǎo." },
                ],
              },
            },
          },
          { id: "r2", type: "essay", prompt: "Nói tự do", passageId: null, config: { freechat: { scenario: "Bạn trò chuyện", opening: "你好！ Nǐ hǎo!", targets: ["住", "离"] } } },
        ],
      },
    },
  }).filter((x) => x.kind === "question");
  it("kịch bản đóng vai tách chữ Hán và phiên âm, giữ tên vai và âm thanh mẫu", () => {
    expect(f[0]).toMatchObject({
      roleplay: { roles: { A: "教练", B: "方强" }, turns: [{ speaker: "A", roleName: "教练", main: "你好！", reading: "Nǐ hǎo!", audioUrl: "/api/exam-assets/a1.mp3" }, { speaker: "B", main: "我刚病好。", audioUrl: undefined }] },
      freechat: null,
    });
  });
  it("nói tự do mang tình huống, lời mở đầu, cụm gợi ý", () => {
    expect(f[1]).toMatchObject({ roleplay: null, freechat: { scenario: "Bạn trò chuyện", opening: "你好！", openingReading: "Nǐ hǎo!", targets: ["住", "离"] } });
  });
});

describe("frameAccent", () => {
  it("màu nhấn theo mục", () => {
    const f = buildTeachingFrames({
      lessonTitle: "B",
      items: [rich("a", "<h2>5语法 · Ngữ pháp</h2><p>x</p><h2>6文化 · Văn hoá</h2><p>y</p>"), dialogue, vocab, practice],
      practices,
    });
    expect(f.map(frameAccent)).toEqual(["lime", "pink", "amber", "violet", "violet", "violet", "teal", "teal", "lime", "lime", "lime"]);
  });
});

describe("sectionName", () => {
  it("rút tên mục ngắn từ tiêu đề bài viết", () => {
    expect(sectionName("2对话 A · Hội thoại: xem nhà")).toBe("Hội thoại A");
    expect(sectionName("4生词 · Từ mới")).toBe("Từ mới");
    expect(sectionName("1情景 · Tình huống")).toBe("Tình huống");
    expect(sectionName("Mục tiêu bài học")).toBe("Mục tiêu bài học");
  });
});
