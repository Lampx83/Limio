import { describe, expect, it } from "vitest";
import {
  INTERACTIVE_PER_PART,
  OUTLINE_KINDS,
  PART_ROLE_LABEL,
  closingIndex,
  inferParts,
  isClosingSlide,
  normalizeOutline,
  outlineBlockingProblems,
  outlineStats,
  outlineWarnings,
  partLabel,
  sanitizeOutline,
  slideRange,
  slideStructureRole,
  slideStructures,
  stripEmoji,
} from "./limioLiveOutline";

const content = (title: string, layout = "image", points: string[] = ["Một câu hoàn chỉnh."]) => ({ kind: "content", layout, title, points });
const inter = (kind: string, title: string) => ({ kind, layout: null, title, points: [] });

describe("slideRange", () => {
  it("rộng hơn bài chỉ có chữ vì mỗi phần có tương tác và bài có slide kết: 15 phút 9-12, 30 phút 16-20, 45 phút 22-28", () => {
    expect(slideRange(15)).toEqual({ min: 9, max: 12 });
    expect(slideRange(30)).toEqual({ min: 16, max: 20 });
    expect(slideRange(45)).toEqual({ min: 22, max: 28 });
  });
  it("giá trị lạ rơi về 30 phút", () => expect(slideRange(7)).toEqual({ min: 16, max: 20 }));
});

describe("stripEmoji", () => {
  it("bỏ emoji, giữ chữ có dấu và dấu câu", () => {
    expect(stripEmoji("Phản hồi 🚀 hiệu quả ✅ trong dạy học!")).toBe("Phản hồi hiệu quả trong dạy học!");
    expect(stripEmoji("Ế ỗ ặ — giữ nguyên.")).toBe("Ế ỗ ặ — giữ nguyên.");
  });
});

describe("sanitizeOutline", () => {
  it("lọc trường lạ, kind/layout sai về mặc định, bỏ slide rỗng, giữ id", () => {
    const o = sanitizeOutline({
      title: " Bài ✨ giảng ",
      slides: [
        { id: "a", kind: "content", layout: "cards", title: "Ba ý", points: ["x", "", "y"], evil: 1 },
        { kind: "lạ", layout: "không có", title: "Mặc định", points: ["p"] },
        { kind: "content", layout: "image", title: "", points: [] },
        { kind: "quiz", layout: "cards", title: "Câu hỏi?", points: ["bỏ"] },
        null,
      ],
    });
    expect(o.title).toBe("Bài giảng");
    expect(o.slides).toHaveLength(3);
    expect(o.slides[0]).toMatchObject({ id: "a", layout: "cards", points: ["x", "y"] });
    expect(o.slides[1]).toMatchObject({ kind: "content", layout: "image" });
    expect(o.slides[2]).toMatchObject({ kind: "quiz", layout: null, points: [] });
    expect(o.slides[0]).not.toHaveProperty("evil");
  });
  it("id trùng được cấp id mới", () => {
    const o = sanitizeOutline({ slides: [{ id: "x", title: "a" }, { id: "x", title: "b" }] });
    expect(new Set(o.slides.map((s) => s.id)).size).toBe(2);
  });
  it("dữ liệu không phải đối tượng cho dàn ý rỗng", () => {
    expect(sanitizeOutline(null)).toEqual({ title: "", slides: [], parts: [] });
    expect(sanitizeOutline("x")).toEqual({ title: "", slides: [], parts: [] });
  });
});

describe("loại slide cộng tác (Dán Note, Draw-it, Whiteboard)", () => {
  it("OUTLINE_KINDS có đủ 7 loại, cùng tên với bộ chọn loại slide", () => {
    expect([...OUTLINE_KINDS]).toEqual(["content", "quiz", "poll", "word_cloud", "collaborate_board", "draw_it", "whiteboard"]);
  });
  it("sanitizeOutline giữ kind mới, bỏ layout và ý chính như mọi slide tương tác", () => {
    const o = sanitizeOutline({
      slides: [
        { kind: "collaborate_board", layout: "cards", title: "Mỗi người dán một vướng mắc.", points: ["bỏ"] },
        { kind: "draw_it", title: "Vẽ sơ đồ quy trình." },
        { kind: "whiteboard", title: "Giải bài toán cùng nhau." },
      ],
    });
    expect(o.slides.map((s) => s.kind)).toEqual(["collaborate_board", "draw_it", "whiteboard"]);
    for (const s of o.slides) expect(s).toMatchObject({ layout: null, points: [] });
  });
  it("dữ liệu dàn ý cũ chỉ có 4 loại cũ vẫn đọc nguyên vẹn", () => {
    const o = sanitizeOutline({ slides: [inter("quiz", "Q?"), inter("poll", "P?"), inter("word_cloud", "W?")] });
    expect(o.slides.map((s) => s.kind)).toEqual(["quiz", "poll", "word_cloud"]);
  });
  it("tính vào slide tương tác và vẫn bị nhắc khi đứng liền nhau hoặc ở cuối bài", () => {
    const o = sanitizeOutline({ slides: [content("A"), inter("whiteboard", "W"), inter("draw_it", "D")] });
    expect(outlineStats(o)).toEqual({ total: 3, content: 1, interactive: 2 });
    const w = outlineWarnings(o, 15);
    expect(w.some((x) => x.includes("liền nhau"))).toBe(true);
    expect(w.some((x) => x.includes("Slide cuối"))).toBe(true);
  });
  it("slide tương tác mới thiếu tiêu đề thì chặn tạo slide, nêu 'câu hỏi'", () => {
    const o = { title: "T", slides: [{ id: "1", kind: "draw_it" as const, layout: null, title: "", points: [] }] };
    expect(outlineBlockingProblems(o)).toEqual(["Slide 1 chưa có câu hỏi."]);
  });
});

describe("normalizeOutline", () => {
  const nine = [
    content("Bìa", "image"),
    content("Mục 1", "section"),
    content("A"),
    content("B"),
    content("C"),
    inter("quiz", "Câu nào đúng?"),
    content("D"),
    content("E"),
    content("Tóm", "image"),
  ];

  it("ép slide đầu là bìa và slide nội dung cuối là tóm tắt", () => {
    const { outline } = normalizeOutline({ title: "T", slides: nine }, 15);
    expect(outline.slides[0]!.layout).toBe("cover");
    expect(outline.slides[outline.slides.length - 1]!.layout).toBe("summary");
  });

  it("quá nhiều slide: giữ phần đầu và slide cuối, kèm cảnh báo", () => {
    const many = [...Array.from({ length: 18 }, (_, i) => content(`Ý ${i}`)), content("Kết", "summary")];
    const { outline, warnings } = normalizeOutline({ title: "T", slides: many }, 15);
    expect(outline.slides).toHaveLength(12);
    expect(outline.slides[11]!.title).toBe("Kết");
    expect(warnings.some((w) => w.includes("đã giữ 12"))).toBe(true);
  });

  it("ít slide hơn mức gợi ý: chỉ cảnh báo, không chặn", () => {
    const { outline, warnings } = normalizeOutline({ title: "T", slides: nine.slice(0, 4) }, 45);
    expect(outline.slides).toHaveLength(4);
    expect(warnings.join(" ")).toContain("ít hơn mức gợi ý 22 đến 28");
  });

  describe("slide kết bài (câu đáng nhớ sau slide Tóm tắt)", () => {
    const withClosing = [
      content("Bìa", "cover"),
      content("Bạn có chắc mình đang học đúng cách?", "quote", []),
      inter("poll", "Bạn thường ôn bài bằng cách nào?"),
      content("A"),
      inter("quiz", "Câu nào đúng?"),
      content("B"),
      content("Điều cần nhớ", "summary"),
      content("Học là thay đổi cách nghĩ, không chỉ thêm thông tin.", "quote", []),
    ];

    it("giữ bố cục Trích dẫn ở slide cuối, không ép thành Tóm tắt", () => {
      const { outline } = normalizeOutline({ title: "T", slides: withClosing }, 15);
      const n = outline.slides.length;
      expect(outline.slides[n - 1]!.layout).toBe("quote");
      expect(outline.slides[n - 2]!.layout).toBe("summary");
      expect(closingIndex(outline.slides)).toEqual({ summary: n - 2, closing: n - 1 });
    });

    it("slide Tóm tắt và slide kết cùng vào phần Tổng kết; slideStructures đánh dấu slide kết", () => {
      const { outline } = normalizeOutline({ title: "T", slides: withClosing }, 15);
      const n = outline.slides.length;
      const sum = outline.parts.find((p) => p.id === outline.slides[n - 2]!.partId)!;
      expect(sum.role).toBe("summary");
      expect(outline.slides[n - 1]!.partId).toBe(sum.id);
      expect(isClosingSlide(outline, outline.slides[n - 1]!)).toBe(true);
      expect(isClosingSlide(outline, outline.slides[1]!)).toBe(false);
      expect(slideStructures(outline)[n - 1]).toEqual({ closing: true });
    });

    it("bài không có tài liệu: chỉ slide kết giữ Trích dẫn, slide Trích dẫn khác đổi sang bố cục chữ", () => {
      const { outline } = normalizeOutline({ title: "T", slides: withClosing }, 15, { sourceKind: "topic" });
      expect(outline.slides[1]!.layout).toBe("image");
      expect(outline.slides[outline.slides.length - 1]!.layout).toBe("quote");
    });

    it("Trích dẫn cuối không đứng sau slide Tóm tắt thì không phải slide kết: ép Tóm tắt như cũ", () => {
      const { outline } = normalizeOutline({ title: "T", slides: [content("Bìa", "cover"), content("A"), content("B"), content("Câu", "quote")] }, 15);
      expect(outline.slides[3]!.layout).toBe("summary");
    });

    it("quá nhiều slide: giữ cả slide Tóm tắt lẫn slide kết", () => {
      const many = [content("Bìa", "cover"), ...Array.from({ length: 16 }, (_, i) => content(`Ý ${i}`)), content("Nhớ", "summary"), content("Câu kết.", "quote", [])];
      const { outline } = normalizeOutline({ title: "T", slides: many }, 15);
      expect(outline.slides).toHaveLength(12);
      expect(outline.slides.slice(-2).map((s) => s.title)).toEqual(["Nhớ", "Câu kết."]);
    });

    it("mô hình ghi vai trò: summary gồm hai slide liền nhau thành một phần", () => {
      const raw = {
        title: "T",
        slides: [
          { role: "cover", section: null, ...content("Bìa", "cover") },
          { role: "content", section: "Phần 1", ...content("A") },
          { role: "content", section: "Phần 1", ...inter("quiz", "Hỏi?") },
          { role: "content", section: "Phần 1", ...content("B") },
          { role: "summary", section: null, ...content("Nhớ", "summary") },
          { role: "summary", section: null, ...content("Câu kết.", "quote", []) },
        ],
      };
      const { outline } = normalizeOutline(raw, 15);
      expect(outline.parts.map((p) => p.role)).toEqual(["cover", "content", "summary"]);
      expect(outline.slides[5]!.layout).toBe("quote");
    });
  });

  it("đầu vào hỏng không làm hỏng chương trình", () => {
    expect(normalizeOutline(undefined, 30).outline.slides).toEqual([]);
    expect(normalizeOutline({ slides: "x" }, 30).outline.slides).toEqual([]);
  });
});

describe("outlineWarnings / outlineStats / outlineBlockingProblems", () => {
  it("đếm slide nội dung và tương tác", () => {
    const o = sanitizeOutline({ slides: [content("a"), inter("poll", "q?"), inter("word_cloud", "w?")] });
    expect(outlineStats(o)).toEqual({ total: 3, content: 1, interactive: 2 });
  });
  it("nhắc hai slide tương tác liền nhau và slide cuối là tương tác", () => {
    const o = sanitizeOutline({ slides: [content("a"), inter("quiz", "q?"), inter("poll", "p?")] });
    const w = outlineWarnings(o, 15).join(" ");
    expect(w).toContain("liền nhau");
    expect(w).toContain("Slide cuối");
  });
  it("chặn khi dàn ý rỗng hoặc slide thiếu tiêu đề", () => {
    expect(outlineBlockingProblems({ title: "", slides: [] })).toHaveLength(1);
    const o = { title: "", slides: [{ id: "1", kind: "quiz" as const, layout: null, title: "", points: [] }] };
    expect(outlineBlockingProblems(o)[0]).toContain("câu hỏi");
  });
  it("phần hook hiện tên Dẫn dắt vào bài", () => expect(PART_ROLE_LABEL.hook).toBe("Dẫn dắt vào bài"));
  it("mỗi phần nội dung 1 đến 2 slide tương tác", () => expect(INTERACTIVE_PER_PART).toEqual({ min: 1, max: 2 }));
  it("nhắc phần nội dung chưa có slide tương tác (khi bài đã có tương tác ở chỗ khác)", () => {
    const o = normalizeOutline(
      {
        title: "T",
        slides: [
          content("Bìa", "cover"),
          content("Phần một", "section"),
          content("A"),
          inter("quiz", "Hỏi?"),
          content("B"),
          content("Phần hai", "section"),
          content("C"),
          content("D"),
          content("Nhớ", "summary"),
        ],
      },
      30,
    ).outline;
    const w = outlineWarnings(o, 30).join(" ");
    expect(w).toContain("Phần “Phần hai” chưa có slide tương tác");
    expect(w).not.toContain("Phần một");
    // Không có phần (dàn ý gọi không kèm parts) thì không nhắc.
    expect(outlineWarnings({ slides: o.slides }, 30).join(" ")).not.toContain("chưa có slide tương tác");
  });
});

describe("mạch cấu trúc: phần của dàn ý", () => {
  const legacy = {
    title: "AR",
    slides: [
      { id: "s1", ...content("Thực tế tăng cường", "cover") },
      { id: "s2", ...content("Khái niệm", "section") },
      { id: "s3", ...content("AR là gì") },
      { id: "s4", ...inter("quiz", "Câu nào đúng?") },
      { id: "s5", ...content("Ứng dụng", "section") },
      { id: "s6", ...content("Ba nhóm ứng dụng", "cards") },
      { id: "s7", ...content("Điều cần nhớ", "summary") },
    ],
  };

  it("dàn ý cũ chưa có phần được tự chia: Bìa, mỗi slide Mở phần một phần Nội dung, Tổng kết", () => {
    const o = sanitizeOutline(legacy);
    expect(o.parts.map((p) => [p.role, p.name])).toEqual([
      ["cover", ""],
      ["content", "Khái niệm"],
      ["content", "Ứng dụng"],
      ["summary", ""],
    ]);
    expect(o.slides.map((s) => o.parts.findIndex((p) => p.id === s.partId))).toEqual([0, 1, 1, 1, 2, 2, 3]);
  });

  it("dàn ý không có slide Mở phần dồn phần giữa vào một phần Nội dung chính", () => {
    const o = inferParts({ title: "T", slides: sanitizeOutline({ slides: [content("Bìa", "cover"), content("A"), content("B"), content("Kết", "summary")] }).slides });
    expect(o.parts.map((p) => [p.role, p.name])).toEqual([["cover", ""], ["content", "Nội dung chính"], ["summary", ""]]);
  });

  it("slide thiếu phần lấy phần của slide trước; phần đứt đoạn được nối lại; phần rỗng bị bỏ", () => {
    const o = sanitizeOutline({
      title: "T",
      parts: [
        { id: "a", role: "hook", name: "bỏ tên" },
        { id: "b", role: "content", name: "B" },
        { id: "c", role: "content", name: "Rỗng" },
      ],
      slides: [
        { id: "1", partId: "a", ...content("Hook") },
        { id: "2", partId: "b", ...content("B1") },
        { id: "3", ...content("B2") },
        { id: "4", partId: "a", ...content("Lạc sang Hook") },
      ],
    });
    expect(o.parts.map((p) => p.id)).toEqual(["a", "b"]);
    expect(o.parts[0]!.name).toBe("");
    expect(o.slides.map((s) => s.partId)).toEqual(["a", "b", "b", "b"]);
  });

  it("tên phần thắng tiêu đề slide mở phần; phần chưa có tên lấy tiêu đề slide", () => {
    const o = sanitizeOutline({
      parts: [{ id: "x", role: "content", name: "Tên mới" }, { id: "y", role: "content", name: "" }],
      slides: [
        { id: "1", partId: "x", ...content("Tên cũ", "section") },
        { id: "2", partId: "y", ...content("Từ slide", "section") },
      ],
    });
    expect(o.slides[0]!.title).toBe("Tên mới");
    expect(o.parts[1]!.name).toBe("Từ slide");
  });

  it("slide Mục lục luôn mang tên các phần Nội dung, giảng viên không nhập tay", () => {
    const o = sanitizeOutline({
      parts: [
        { id: "ag", role: "agenda", name: "" },
        { id: "c1", role: "content", name: "Khái niệm" },
        { id: "c2", role: "content", name: "Ứng dụng" },
      ],
      slides: [
        { id: "1", partId: "ag", ...content("Nội dung buổi học", "summary", ["gõ tay"]) },
        { id: "2", partId: "c1", ...content("x", "section") },
        { id: "3", partId: "c2", ...content("y", "section") },
      ],
    });
    expect(o.slides[0]!.points).toEqual(["Khái niệm", "Ứng dụng"]);
    expect(slideStructureRole(o, o.slides[0]!)).toBe("agenda");
    expect(slideStructureRole(o, o.slides[1]!)).toBe("opener");
  });

  it("slideStructures: số phần, mục lục và vị trí phần hiện tại cho slide mở phần", () => {
    const o = sanitizeOutline(legacy);
    const st = slideStructures(o);
    expect(st[1]).toEqual({ sectionNo: "01", toc: ["Khái niệm", "Ứng dụng"], tocCurrent: 1 });
    expect(st[4]).toEqual({ sectionNo: "02", toc: ["Khái niệm", "Ứng dụng"], tocCurrent: 2 });
    expect(st[2]).toBeNull();
  });

  it("partLabel đánh số phần Nội dung", () => {
    const o = sanitizeOutline(legacy);
    expect(o.parts.map((p) => partLabel(o, p.id))).toEqual(["Bìa", "Nội dung 1: Khái niệm", "Nội dung 2: Ứng dụng", "Tổng kết"]);
  });
});

describe("normalizeOutline với vai trò do AI gán", () => {
  const r = (role: string, section: string | null, s: object) => ({ role, section, ...s });
  const full = {
    title: "AR",
    slides: [
      r("cover", null, content("AR trong giáo dục", "cover")),
      r("objectives", null, content("Mục tiêu", "summary", ["Người học giải thích được AR."])),
      r("agenda", null, content("Nội dung buổi học", "summary", [])),
      r("hook", null, inter("poll", "Bạn đã dùng AR chưa?")),
      r("content", "Khái niệm", content("Khái niệm", "section")),
      r("content", "Khái niệm", content("AR là gì")),
      r("content", "Ứng dụng", content("Ba nhóm ứng dụng", "cards")),
      r("content", "Ứng dụng", inter("quiz", "Câu nào đúng?")),
      r("summary", null, content("Điều cần nhớ", "summary")),
    ],
  };

  it("gom slide liền nhau cùng vai trò thành phần; tên phần Nội dung lấy từ 'section'", () => {
    const { outline } = normalizeOutline(full, 15);
    expect(outline.parts.map((p) => [p.role, p.name])).toEqual([
      ["cover", ""],
      ["objectives", ""],
      ["agenda", ""],
      ["hook", ""],
      ["content", "Khái niệm"],
      ["content", "Ứng dụng"],
      ["summary", ""],
    ]);
    expect(outline.slides[2]!.points).toEqual(["Khái niệm", "Ứng dụng"]);
  });

  it("buổi từ 30 phút: phần Nội dung thiếu slide Mở phần được thêm khi còn chỗ", () => {
    const { outline } = normalizeOutline(full, 30);
    const ung = outline.parts.find((p) => p.name === "Ứng dụng")!;
    const first = outline.slides.find((s) => s.partId === ung.id)!;
    expect(first).toMatchObject({ layout: "section", title: "Ứng dụng" });
    expect(outline.slides).toHaveLength(10);
  });

  it("buổi 15 phút không thêm slide Mở phần", () => {
    const { outline } = normalizeOutline(full, 15);
    expect(outline.slides.filter((s) => s.layout === "section")).toHaveLength(1);
  });

  it("vai trò lạ tiếp tục phần trước", () => {
    const { outline } = normalizeOutline({ slides: [r("cover", null, content("Bìa", "cover")), r("lạ", null, content("A")), r("summary", null, content("Kết", "summary"))] }, 15);
    expect(outline.slides.map((s) => outline.parts.find((p) => p.id === s.partId)!.role)).toEqual(["cover", "cover", "summary"]);
  });

  it("mô hình không gán vai trò: chia lại sau khi ép bìa, nên slide đầu nằm trong phần Bìa", () => {
    const { outline } = normalizeOutline({ title: "T", slides: [content("Bìa", "image"), content("A"), content("Kết", "image")] }, 15);
    expect(outline.parts.map((p) => p.role)).toEqual(["cover", "content", "summary"]);
  });
});
