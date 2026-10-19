import { describe, expect, it } from "vitest";
import { extractCites, figureKeys, formatCite, statFigures, unsupportedFigures } from "./limioLiveFigures";
import {
  normalizeOutline,
  slideRange,
  outlineWarnings,
  referencesOutlineSlide,
  resolveSourceKind,
  safeLayoutFor,
  sanitizeOutline,
  type OutlineSlide,
} from "./limioLiveOutline";
import { configFromOutline, draftToSlide, generateDeckSlides, proposalFromDraft, type SlideDraft } from "./limioLiveGenerate";
import { pickMeta } from "./limioLiveSlides";
import { searchQueryFromTopic, tavilyProvider, toSourcePages } from "./webSearch";

/** Bài giảng từ mô tả chủ đề — docs/tieu-chi/bai-giang-tu-chu-de.md (T10–T15, T21–T23). */

const os = (id: string, layout: OutlineSlide["layout"], title: string, points: string[] = []): OutlineSlide => ({ id, kind: "content", layout, title, points });
const REFS = [
  { n: 1, title: "Thực tế tăng cường là gì", url: "https://vi.example.org/ar" },
  { n: 2, title: "AR in education", url: "https://edu.example.com/ar" },
];
const TOPIC = "Bài về thực tế tăng cường cho sinh viên năm cuối.";
const WEB_SOURCE = `${TOPIC}\n\n# Nguồn tìm trên internet\n[1] Thực tế tăng cường là gì (https://vi.example.org/ar)\nKhảo sát năm 2023 cho thấy 45% giáo viên đã thử AR.\n\n[2] AR in education (https://edu.example.com/ar)\nAR overlays digital content.`;

describe("statFigures: con số kiểu thống kê", () => {
  it("bắt phần trăm, năm, số có phân cách hàng nghìn, số kèm triệu/tỷ, số lớn", () => {
    expect(statFigures("Có 45% giáo viên và 3,5 triệu học sinh từ năm 2023, tổng 1.250 trường, 12000 lượt.")).toEqual([
      "45%",
      "3,5 triệu",
      "2023",
      "1.250",
      "12000",
    ]);
  });

  it("không bắt số nhỏ thường gặp trong bài học", () => {
    expect(statFigures("Ba bước, lớp 9, phương trình x² − 5x + 6 = 0, Web 2.0, HTML5, ISO 9001.")).toEqual([]);
  });

  it("so khớp theo phần chữ số: cách viết khác nhau của cùng con số vẫn khớp", () => {
    expect(unsupportedFigures("45 % giáo viên, năm 2023", WEB_SOURCE)).toEqual([]);
    expect(unsupportedFigures("60% giáo viên, năm 2021", WEB_SOURCE)).toEqual(["60%", "2021"]);
    expect(figureKeys("1.250 trường").has("1250")).toBe(true);
  });
});

describe("số nguồn [n]", () => {
  it("gỡ số nguồn khỏi câu và gom lại", () => {
    expect(extractCites("AR chồng thông tin số lên cảnh thật [1]. Nhiều giáo viên đã thử [1, 2].")).toEqual({
      text: "AR chồng thông tin số lên cảnh thật. Nhiều giáo viên đã thử.",
      nums: [1, 2],
    });
  });

  it("chỉ giữ số có trong danh sách nguồn, sắp xếp, không lặp", () => {
    expect(formatCite([2, 1, 2, 7], 2)).toBe("Nguồn: [1], [2]");
    expect(formatCite([7], 2)).toBe("");
  });
});

describe("loại nguồn", () => {
  it("bài cũ có dàn ý (không ghi nguồn) coi như tài liệu", () => {
    expect(resolveSourceKind(null)).toBe("document");
    expect(resolveSourceKind("topic")).toBe("topic");
    expect(resolveSourceKind("lạ")).toBe("document");
  });

  it("mức kiến thức chung đổi Số liệu và Trích dẫn sang Thẻ ý và Chữ và hình (T10)", () => {
    expect(safeLayoutFor("topic", "stats")).toBe("cards");
    expect(safeLayoutFor("topic", "quote")).toBe("image");
    expect(safeLayoutFor("topic_web", "stats")).toBe("stats");
    expect(safeLayoutFor("document", "quote")).toBe("quote");
  });
});

describe("normalizeOutline — mô tả chủ đề", () => {
  const raw = {
    title: "AR trong lớp học",
    slides: [
      { role: "cover", section: null, kind: "content", layout: "cover", title: "AR trong lớp học", points: ["Bài giúp người học hiểu AR."] },
      { role: "content", section: "Khái niệm", kind: "content", layout: "stats", title: "AR qua con số", points: ["45% giáo viên đã thử AR."] },
      { role: "content", section: "Khái niệm", kind: "content", layout: "quote", title: "Một câu nói", points: ["AR là cầu nối."] },
      { role: "summary", section: null, kind: "content", layout: "summary", title: "Ghi nhớ", points: ["AR chồng lớp số lên cảnh thật."] },
    ],
  };

  it("bỏ Số liệu và Trích dẫn ở mức kiến thức chung (T10); tài liệu thì giữ", () => {
    const topic = normalizeOutline(raw, 15, { sourceKind: "topic", sourceText: TOPIC }).outline;
    expect(topic.slides.map((s) => s.layout)).not.toContain("stats");
    expect(topic.slides.map((s) => s.layout)).not.toContain("quote");
    const doc = normalizeOutline(raw, 15).outline;
    expect(doc.slides.map((s) => s.layout)).toContain("stats");
  });

  it("mức kiến thức chung không có nguồn nào: số nguồn [n] AI lỡ ghi bị gỡ khỏi dàn ý", () => {
    const withCite = { ...raw, slides: raw.slides.map((x, i) => (i === 3 ? { ...x, points: ["AR chồng lớp số lên cảnh thật [1]."] } : x)) };
    const topic = normalizeOutline(withCite, 15, { sourceKind: "topic", sourceText: TOPIC }).outline;
    expect(topic.slides[topic.slides.length - 1]!.points).toEqual(["AR chồng lớp số lên cảnh thật."]);
    const doc = normalizeOutline(withCite, 15).outline;
    expect(doc.slides[doc.slides.length - 1]!.points[0]).toContain("[1]");
  });

  it("cảnh báo con số kiểu thống kê không có trong mô tả hoặc nguồn (T11, T15)", () => {
    const { warnings } = normalizeOutline(raw, 15, { sourceKind: "topic", sourceText: TOPIC });
    expect(warnings.some((w) => w.includes("Slide 2") && w.includes("45%"))).toBe(true);
    const web = normalizeOutline(raw, 15, { sourceKind: "topic_web", sourceText: WEB_SOURCE, references: REFS });
    expect(web.warnings.some((w) => w.includes("45%"))).toBe(false);
    expect(outlineWarnings(web.outline, 15, { sourceKind: "topic_web", sourceText: TOPIC }).some((w) => w.includes("45%"))).toBe(true);
    expect(outlineWarnings(web.outline, 15).some((w) => w.includes("45%"))).toBe(false);
  });

  it("mức có nguồn thêm dòng cuối Nguồn tham khảo do hệ thống dựng, giữ trong mức slide (T14)", () => {
    const many = { ...raw, slides: [...raw.slides.slice(0, 3), ...Array.from({ length: 16 }, (_, i) => ({ ...raw.slides[1], layout: "cards", title: `Ý ${i}`, points: [] })), raw.slides[3]] };
    const { outline } = normalizeOutline(many, 15, { sourceKind: "topic_web", sourceText: WEB_SOURCE, references: REFS });
    expect(outline.slides.length).toBeLessThanOrEqual(slideRange(15).max);
    const last = outline.slides[outline.slides.length - 1]!;
    expect(last).toMatchObject({ fixed: "references", layout: "summary", title: "Nguồn tham khảo" });
    expect(last.points).toEqual(["[1] Thực tế tăng cường là gì", "[2] AR in education"]);
    expect(outline.slides[outline.slides.length - 2]!.title).toBe("Ghi nhớ");
  });

  it("dòng Nguồn tham khảo sống qua lưu dàn ý; dòng thường không tự nhận cờ", () => {
    const o = sanitizeOutline({ title: "T", slides: [os("a", "cover", "Bìa"), { ...referencesOutlineSlide(REFS), id: "r" }, { ...os("b", "image", "B"), fixed: "khác" }] });
    expect(o.slides.find((s) => s.id === "r")!.fixed).toBe("references");
    expect(o.slides.find((s) => s.id === "b")!.fixed).toBeUndefined();
  });
});

describe("draftToSlide — mô tả chủ đề", () => {
  const topicCtx = { sourceKind: "topic" as const, sourceText: TOPIC };
  const webCtx = { sourceKind: "topic_web" as const, sourceText: WEB_SOURCE, refs: REFS };
  const image = os("o1", "image", "AR khác VR ở điểm nào", ["AR chồng thông tin số lên cảnh thật."]);
  const goodDraft: SlideDraft = {
    index: 0,
    title: "AR khác VR ở điểm nào",
    bullets: ["AR chồng thông tin số lên cảnh thật.", "VR thay cảnh thật bằng mô phỏng.", "AR hợp với hoạt động gắn vật thật."],
  };

  it("dòng Số liệu hoặc Trích dẫn còn sót được tạo bằng bố cục an toàn (T21)", () => {
    const g = draftToSlide(os("s", "stats", "AR qua con số", ["Chồng lớp: AR đặt thông tin số lên cảnh thật."]), undefined, "", topicCtx);
    expect(g.config.layout).toBe("cards");
    const q = configFromOutline(os("q", "quote", "Thông điệp", ["AR là cầu nối giữa thật và số."]), "", undefined, topicCtx);
    expect(q.config.layout).toBe("image");
  });

  it("bản nháp có con số không có trong dàn ý hay mô tả thì rơi về dàn ý (T22)", () => {
    const ok = draftToSlide(image, goodDraft, "", topicCtx);
    expect(ok.usedFallback).toBe(false);
    const bad = draftToSlide(image, { ...goodDraft, bullets: ["Năm 2023 có 45% giáo viên dùng AR.", ...goodDraft.bullets!.slice(1)] }, "", topicCtx);
    expect(bad.usedFallback).toBe(true);
    expect(JSON.stringify(bad.config)).not.toContain("45%");
    // Bài từ tài liệu: kiểm tra này không áp dụng (giữ hành vi cũ).
    expect(draftToSlide(image, { ...goodDraft, bullets: ["Năm 2023 có 45% giáo viên dùng AR."] }, "").usedFallback).toBe(false);
  });

  it("mức có nguồn: con số có trong nguồn được giữ, số nguồn gom ra chân slide (T23)", () => {
    const g = draftToSlide(image, { ...goodDraft, bullets: ["Khảo sát năm 2023 cho thấy 45% giáo viên đã thử AR [1].", "VR thay cảnh thật [2].", "AR hợp với lớp học."] }, "", webCtx);
    expect(g.usedFallback).toBe(false);
    expect(g.config.cite).toBe("Nguồn: [1], [2]");
    expect((g.config.bullets as string[])[0]).toBe("Khảo sát năm 2023 cho thấy 45% giáo viên đã thử AR.");
    const fromSource = draftToSlide(image, { ...goodDraft, source: "[2]" }, "", webCtx);
    expect(fromSource.config.cite).toBe("Nguồn: [2]");
    const bad = draftToSlide(image, { ...goodDraft, bullets: ["60% giáo viên đã thử AR [1]."] }, "", webCtx);
    expect(bad.usedFallback).toBe(true);
  });

  it("slide Nguồn tham khảo giữ đúng chữ của dàn ý, ghi chú giảng có địa chỉ đầy đủ", () => {
    const refs = { ...referencesOutlineSlide(REFS), id: "r" };
    const g = draftToSlide(refs, { index: 0, title: "AI tự viết", items: [{ heading: "Bịa", body: "", icon: "" }] }, "", webCtx);
    expect(g.usedFallback).toBe(false);
    expect(g.config).toMatchObject({ layout: "summary", title: "Nguồn tham khảo" });
    expect((g.config.items as Array<{ heading: string }>).map((i) => i.heading)).toEqual(refs.points);
    expect(g.config.presenterNote).toContain("https://edu.example.com/ar");
  });

  it("dòng Nguồn tham khảo không gửi cho AI viết", async () => {
    const outline = [os("a", "cover", "Bìa", ["Bài về AR."]), { ...referencesOutlineSlide(REFS), id: "r" }];
    const asked: number[][] = [];
    const res = await generateDeckSlides({
      outline,
      isFatal: () => false,
      context: webCtx,
      generateBatch: async (idx) => {
        asked.push(idx);
        return idx.map((index) => ({ index, title: "Bìa", subtitle: "Bài giúp người học hiểu AR." }));
      },
    });
    expect(asked).toEqual([[0]]);
    expect(res.slides[1]!.config.title).toBe("Nguồn tham khảo");
  });

  it("nhờ AI sửa slide dùng cùng kiểm tra con số (T24)", () => {
    const current = { config: { layout: "image", title: "AR", bullets: ["AR chồng lớp số."], outlineId: "o1", cite: "Nguồn: [1]" } };
    expect(proposalFromDraft("rewrite", current, { ...goodDraft, bullets: ["Có 45% giáo viên dùng AR."] }, topicCtx)).toBeNull();
    const ok = proposalFromDraft("rewrite", current, { ...goodDraft, bullets: ["VR thay cảnh thật [2]."] }, webCtx);
    expect(ok!.config.cite).toBe("Nguồn: [2]");
  });

  it("dòng nguồn ở chân slide là khoá meta, sống qua lọc bố cục", () => {
    expect(pickMeta({ cite: "Nguồn: [1]" })).toEqual({ cite: "Nguồn: [1]" });
    expect(pickMeta({ cite: "  " })).toEqual({});
  });
});

describe("tìm kiếm web", () => {
  it("câu tìm kiếm là mô tả gọn khoảng trắng, không quá 380 ký tự, cắt ở ranh giới từ", () => {
    expect(searchQueryFromTopic("  AR\n\ntrong   lớp học ")).toBe("AR trong lớp học");
    const q = searchQueryFromTopic("thực tế tăng cường ".repeat(40));
    expect(q.length).toBeLessThanOrEqual(380);
    expect(q.endsWith(" ")).toBe(false);
  });

  it("chuẩn hoá trang: bỏ trùng địa chỉ, bỏ trang quá ít chữ, tối đa 5 trang, đánh số lại", () => {
    const long = "Nội dung đủ dài về thực tế tăng cường. ".repeat(20);
    const pages = toSourcePages([
      { title: "A", url: "https://a.org/x", content: long },
      { title: "A trùng", url: "https://a.org/x#top", content: long },
      { title: "", url: "https://b.org/y", content: long },
      { title: "Ngắn", url: "https://c.org", content: "Quá ngắn." },
      ...Array.from({ length: 6 }, (_, i) => ({ title: `T${i}`, url: `https://d${i}.org`, content: long })),
    ]);
    expect(pages).toHaveLength(5);
    expect(pages.map((p) => p.n)).toEqual([1, 2, 3, 4, 5]);
    expect(pages[1]!.title).toBe("b.org");
    expect(pages[0]!.content.length).toBeLessThanOrEqual(3500);
  });

  it("adapter Tavily: gửi khoá qua header, đọc raw_content, lỗi mạng trả mảng rỗng", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ results: [{ title: "A", url: "https://a.org", content: "ngắn", raw_content: "đầy đủ" }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const p = tavilyProvider("tvly-test", fakeFetch);
    const out = await p.search("AR trong lớp học", 8);
    expect(out).toEqual([{ title: "A", url: "https://a.org", content: "đầy đủ" }]);
    expect(calls[0]!.url).toBe("https://api.tavily.com/search");
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe("Bearer tvly-test");
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ query: "AR trong lớp học", max_results: 8, include_raw_content: "markdown" });

    const failing = tavilyProvider("k", (async () => new Response("no", { status: 500 })) as unknown as typeof fetch);
    await expect(failing.search("x", 5)).resolves.toEqual([]);
  });
});
