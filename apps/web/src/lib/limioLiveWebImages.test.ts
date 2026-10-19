import { describe, expect, it } from "vitest";
import { imageCredit, extractPageImages, shortUrl, stripMarkdownMedia, webImageCandidates, WEB_IMAGES_PER_PAGE, WEB_IMAGES_TOTAL } from "./limioLiveWebImages";
import { referencesOutlineSlide, sanitizeRefs } from "./limioLiveOutline";
import { draftToSlide } from "./limioLiveGenerate";
import { sanitizeLayoutConfig } from "./limioLiveSlides";
import { tavilyProvider, toSourcePages } from "./webSearch";

/** Link nguồn và ảnh minh hoạ từ nguồn internet — docs/tieu-chi/nguon-web-link-anh.md (W1–W15). */

const PAGE = "https://vi.wikipedia.org/wiki/Th%E1%BB%B1c_t%E1%BA%BF_t%C4%83ng_c%C6%B0%E1%BB%9Dng";

describe("extractPageImages (W6, W7)", () => {
  it("lấy ảnh trong chữ markdown kèm chữ thay thế, giải địa chỉ tương đối theo trang", () => {
    const md = `Đoạn mở đầu.\n\n![Học sinh dùng máy tính bảng xem mô hình ba chiều](/images/ar-lop-hoc.jpg)\n\nĐoạn khác ![Kính thực tế ảo](https://cdn.example.org/vr.png "tiêu đề")`;
    expect(extractPageImages(md, PAGE)).toEqual([
      { url: "https://vi.wikipedia.org/images/ar-lop-hoc.jpg", alt: "Học sinh dùng máy tính bảng xem mô hình ba chiều" },
      { url: "https://cdn.example.org/vr.png", alt: "Kính thực tế ảo" },
    ]);
  });

  it("ảnh thiếu chữ thay thế lấy dòng chú thích ngay dưới; không có mô tả nào thì bỏ (W6)", () => {
    const md = [
      "![](https://a.org/so-do.jpg)",
      "*Hình 2. Sơ đồ ba lớp của một hệ thống thực tế tăng cường*",
      "",
      "![](https://a.org/khong-chu-thich.jpg)",
      "",
      "![](https://a.org/ke-anh-khac.jpg)",
      "![Ảnh có chữ thay thế](https://a.org/co-alt.jpg)",
    ].join("\n");
    expect(extractPageImages(md, "https://a.org/bai")).toEqual([
      { url: "https://a.org/so-do.jpg", alt: "Hình 2. Sơ đồ ba lớp của một hệ thống thực tế tăng cường" },
      { url: "https://a.org/co-alt.jpg", alt: "Ảnh có chữ thay thế" },
    ]);
  });

  it("loại SVG, GIF, biểu tượng, logo, ảnh đại diện, quảng cáo, data:, địa chỉ lạ; bỏ trùng; tối đa 3 ảnh mỗi trang", () => {
    const md = [
      "![logo](https://a.org/logo.png)",
      "![](https://a.org/assets/icon-search.png)",
      "![avatar](https://a.org/u/avatar_12.jpg)",
      "![ảnh](https://a.org/x.svg)",
      "![ảnh động](https://a.org/x.gif)",
      "![quảng cáo](https://ads.a.org/banner-ad.jpg)",
      "![x](data:image/png;base64,AAAA)",
      "![x](javascript:alert(1))",
      "![Sơ đồ 1](https://a.org/1.jpg)",
      "![Sơ đồ 1 lặp](https://a.org/1.jpg)",
      "![Sơ đồ 2](https://a.org/2.webp)",
      "![Sơ đồ 3](https://a.org/3.jpeg?w=800)",
      "![Sơ đồ 4](https://a.org/4.jpg)",
    ].join("\n");
    const imgs = extractPageImages(md, "https://a.org/bai");
    expect(imgs.map((i) => i.url)).toEqual(["https://a.org/1.jpg", "https://a.org/2.webp", "https://a.org/3.jpeg?w=800"]);
    expect(WEB_IMAGES_PER_PAGE).toBe(3);
    expect(WEB_IMAGES_TOTAL).toBe(8);
  });
});

describe("stripMarkdownMedia", () => {
  it("bỏ ảnh và giữ chữ của link khỏi phần chữ đưa cho AI", () => {
    expect(stripMarkdownMedia("AR là ![h](https://a.org/h.jpg) công nghệ [chồng lớp](https://a.org/x) số.")).toBe("AR là công nghệ chồng lớp số.");
  });
});

describe("toSourcePages + sanitizeRefs giữ ảnh theo trang", () => {
  it("trang có ảnh: chữ cho AI không còn ảnh, danh sách ảnh đi kèm đúng trang", () => {
    const long = "Thực tế tăng cường chồng thông tin số lên khung cảnh thật. ".repeat(10);
    const pages = toSourcePages([{ title: "AR", url: "https://a.org/ar", content: `${long}\n![Mô hình ba chiều trên bàn](https://a.org/m.jpg)` }]);
    expect(pages[0]!.content).not.toContain("m.jpg");
    expect(pages[0]!.images).toEqual([{ url: "https://a.org/m.jpg", alt: "Mô hình ba chiều trên bàn" }]);
    const refs = sanitizeRefs([{ n: 1, title: "AR", url: "https://a.org/ar", images: [{ url: "https://a.org/m.jpg", alt: "x" }, { url: "ftp://bad", alt: "y" }] }]);
    expect(refs[0]!.images).toEqual([{ url: "https://a.org/m.jpg", alt: "x" }]);
  });

  it("Tavily: xin chữ dạng markdown và ảnh kèm mô tả của từng kết quả, trong cùng một lượt tìm (W6)", async () => {
    let body: Record<string, unknown> = {};
    const fakeFetch = (async (_u: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return new Response(
        JSON.stringify({
          images: [{ url: "https://x.org/khong-gan-trang.jpg", description: "ảnh chung của câu tìm" }],
          results: [
            {
              title: "AR",
              url: "https://a.org/ar",
              raw_content: "Nội dung",
              images: [{ url: "https://a.org/hs.jpg", description: "Students using tablets to view a 3D model" }, { url: 42 }, "x"],
            },
          ],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const pages = await tavilyProvider("k", fakeFetch).search("AR", 5);
    expect(body).toMatchObject({ include_raw_content: "markdown", include_images: true, include_image_descriptions: true, search_depth: "basic" });
    expect(pages[0]!.images).toEqual([{ url: "https://a.org/hs.jpg", alt: "Students using tablets to view a 3D model" }]);
  });

  it("toSourcePages: ảnh Tavily (có mô tả) đứng trước ảnh trong markdown, bỏ trùng, lọc ảnh rác và ảnh không mô tả (W6, W7)", () => {
    const long = "Thực tế tăng cường chồng thông tin số lên khung cảnh thật. ".repeat(10);
    const pages = toSourcePages([
      {
        title: "AR",
        url: "https://a.org/ar",
        content: `${long}\n![Mô hình trên bàn](https://a.org/m.jpg)\n![Ảnh trùng](https://a.org/hs.jpg)`,
        images: [
          { url: "https://a.org/hs.jpg", alt: "Students using tablets" },
          { url: "https://a.org/logo.png", alt: "Company logo" },
          { url: "https://a.org/khong-mo-ta.jpg", alt: "" },
        ],
      },
    ]);
    expect(pages[0]!.images).toEqual([
      { url: "https://a.org/hs.jpg", alt: "Students using tablets" },
      { url: "https://a.org/m.jpg", alt: "Mô hình trên bàn" },
    ]);
  });
});

describe("webImageCandidates (W8)", () => {
  it("đánh mã A1, A2… theo thứ tự trang rồi ảnh, tối đa 8; mỗi mã nhớ trang nguồn", () => {
    const img = (k: number) => ({ url: `https://a.org/${k}.jpg`, alt: `Ảnh ${k}` });
    const refs = [
      { n: 1, title: "Một", url: "https://a.org/1", images: [img(1), img(2), img(3)] },
      { n: 2, title: "Hai", url: "https://b.org/2" },
      { n: 3, title: "Ba", url: "https://c.org/3", images: [img(4), img(5), img(6)] },
      { n: 4, title: "Bốn", url: "https://d.org/4", images: [img(7), img(8), img(9)] },
    ];
    const c = webImageCandidates(refs);
    expect(c.map((x) => x.id)).toEqual(["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"]);
    expect(c[3]).toMatchObject({ id: "A4", image: img(4), ref: { n: 3 } });
    expect(webImageCandidates([{ n: 1, title: "x", url: "https://x.org" }])).toEqual([]);
  });
});

describe("draftToSlide nhận mã ảnh AI chọn (W8)", () => {
  const os = (layout: "image" | "cards") => ({ id: "o1", kind: "content" as const, layout, title: "AR trong lớp", points: [] });
  const bullets = ["Một câu đủ ý.", "Hai câu đủ ý.", "Ba câu đủ ý."];
  it("chỉ slide Chữ và hình giữ mã đúng dạng; none, rỗng, mã lạ thì bỏ", () => {
    expect(draftToSlide(os("image"), { index: 0, title: "AR", bullets, webImage: "A3" }, "").webImage).toBe("A3");
    for (const v of ["none", "", "B1", "A", "A123", "<x>"]) expect(draftToSlide(os("image"), { index: 0, title: "AR", bullets, webImage: v }, "").webImage).toBeUndefined();
    const items = [1, 2, 3].map((n) => ({ heading: `Ý ${n}`, body: "Một câu.", icon: "target" }));
    expect(draftToSlide(os("cards"), { index: 0, title: "AR", items, webImage: "A1" }, "").webImage).toBeUndefined();
  });
});

describe("dòng ghi nguồn và địa chỉ rút gọn (W1, W10)", () => {
  it("ghi nguồn ảnh: Tên trang (tên miền), không quá 120 ký tự; phần vẽ tự thêm Nguồn ảnh:", () => {
    expect(imageCredit({ n: 1, title: "Thực tế tăng cường", url: "https://www.vi.wikipedia.org/wiki/AR" })).toBe("Thực tế tăng cường (vi.wikipedia.org)");
    expect(imageCredit({ n: 1, title: "x".repeat(300), url: "https://a.org" }).length).toBeLessThanOrEqual(120);
  });

  it("địa chỉ rút gọn: bỏ giao thức và www, giải mã tiếng Việt, cắt bớt khi dài", () => {
    expect(shortUrl(PAGE)).toBe("vi.wikipedia.org/wiki/Thực_tế_tăng_cường");
    expect(shortUrl("https://www.example.org/")).toBe("example.org");
    const s = shortUrl(`https://example.org/${"a".repeat(100)}`);
    expect(s.length).toBeLessThanOrEqual(56);
    expect(s.endsWith("…")).toBe(true);
  });
});

describe("slide Nguồn tham khảo có link (W1–W5)", () => {
  const refs = [
    { n: 1, title: "Thực tế tăng cường", url: PAGE },
    { n: 2, title: "AR in education", url: "https://edu.example.com/ar" },
  ];

  it("dòng dàn ý là [n] Tên trang (địa chỉ nằm ở dòng phụ của slide)", () => {
    expect(referencesOutlineSlide(refs).points).toEqual(["[1] Thực tế tăng cường", "[2] AR in education"]);
  });

  it("mỗi dòng của slide mang link tới đúng trang theo số [n], kể cả khi giảng viên sửa tên", () => {
    const os = { ...referencesOutlineSlide(refs), id: "r", points: ["[2] Bài về AR trong giáo dục", "[1] Thực tế tăng cường"] };
    const g = draftToSlide(os, undefined, "", { sourceKind: "topic_web", sourceText: "", refs });
    expect(g.config.items).toEqual([
      { heading: "[2] Bài về AR trong giáo dục", body: "", href: "https://edu.example.com/ar" },
      { heading: "[1] Thực tế tăng cường", body: "", href: PAGE },
    ]);
  });

  it("chỉ giữ link http(s) ở slide Tóm tắt; bố cục khác bỏ link", () => {
    const ok = sanitizeLayoutConfig("summary", { title: "T", items: [{ heading: "A", href: "https://a.org" }, { heading: "B", href: "javascript:alert(1)" }] });
    expect(ok.items).toEqual([{ heading: "A", body: "", href: "https://a.org" }, { heading: "B", body: "" }]);
    const cards = sanitizeLayoutConfig("cards", { title: "T", items: [{ heading: "A", body: "b", href: "https://a.org" }, { heading: "C", body: "d" }] });
    expect((cards.items as Array<Record<string, unknown>>)[0]!.href).toBeUndefined();
  });
});
