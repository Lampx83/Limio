import { describe, expect, it } from "vitest";
import {
  convertLayoutConfig,
  dataSlideMetrics,
  emptyLayoutConfig,
  layoutTextProblems,
  normalizeContentSlideConfig,
  padForEditing,
  sanitizeLayoutConfig,
  splitSlideConfig,
} from "./limioLiveSlides";
import { configFromOutline, dataNumbersVerified, draftToSlide, generateDeckSlides, proposalFromDraft } from "./limioLiveGenerate";
import { demoteUnbackedCharts, type OutlineSlide } from "./limioLiveOutline";
import { numbersInText } from "./limioLiveCharts";

// Hai bố cục Bảng và Biểu đồ: lọc dữ liệu, đổi bố cục không mất nội dung, chống bịa số liệu
// (cả cho bố cục Số liệu, vốn cũng trình bày con số).

describe("sanitizeLayoutConfig — bảng", () => {
  it("giữ tối đa 5 cột × 6 dòng, cắt ô dài, bù ô thiếu, bỏ dòng trống", () => {
    const rows = Array.from({ length: 8 }, (_, i) => [`r${i}`, "x".repeat(90), "", "", "", "thừa"]);
    rows.splice(1, 0, ["", "", ""]);
    const c = sanitizeLayoutConfig("table", { title: "Bảng", head: ["A", "B"], rows, source: " Tài liệu " }) as any;
    // Cột 3–5 trống ở mọi dòng (cột "thừa" là cột thứ 6, bị cắt) nên bị bỏ.
    expect(c.head).toEqual(["A", "B"]);
    expect(c.rows).toHaveLength(6);
    expect(c.rows[0]).toEqual(["r0", "x".repeat(60)]);
    expect(c.rows[1][0]).toBe("r1");
    expect(c.source).toBe("Tài liệu");
  });
  it("bỏ các cột trống ở cuối; số trong ô được giữ dạng chữ", () => {
    const c = sanitizeLayoutConfig("table", { head: ["A", "B", "", ""], rows: [["x", 3.5, "", ""]] }) as any;
    expect(c.head).toEqual(["A", "B"]);
    expect(c.rows).toEqual([["x", "3.5"]]);
  });
  it("không nhận trường lạ của bố cục khác", () => {
    const c = sanitizeLayoutConfig("table", { head: ["A", "B"], rows: [["1", "2"]], items: [{ heading: "x" }], quote: "q" });
    expect(Object.keys(c).sort()).toEqual(["head", "layout", "rows"]);
  });
});

describe("sanitizeLayoutConfig — biểu đồ", () => {
  it("đọc số từ chữ kiểu Việt Nam, ô hỏng thành null, giữ thẳng hàng nhãn và số", () => {
    const c = sanitizeLayoutConfig("chart", {
      chartType: "line",
      labels: ["T1", "T2", "", "T4"],
      series: [{ name: "Lớp A", values: ["3,5", "abc", "", 7] }],
      unit: "điểm",
    }) as any;
    expect(c.chartType).toBe("line");
    expect(c.labels).toEqual(["T1", "T2", "T4"]); // dòng không nhãn, không số bị bỏ
    expect(c.series[0].values).toEqual([3.5, null, 7]);
    expect(c.unit).toBe("điểm");
  });
  it("loại lạ thành cột; tối đa 2 chuỗi, 8 nhãn; chuỗi hai rỗng bị bỏ", () => {
    const labels = Array.from({ length: 10 }, (_, i) => `N${i}`);
    const c = sanitizeLayoutConfig("chart", {
      chartType: "radar",
      labels,
      series: [{ name: "", values: labels.map((_, i) => i) }, { name: "", values: [] }, { name: "Ba", values: [1] }],
    }) as any;
    expect(c.chartType).toBe("bar");
    expect(c.labels).toHaveLength(8);
    expect(c.series).toHaveLength(1);
  });
  it("giữ chuỗi thứ hai cả khi là biểu đồ tròn (đổi loại không mất dữ liệu)", () => {
    const c = sanitizeLayoutConfig("chart", { chartType: "pie", labels: ["A", "B"], series: [{ name: "x", values: [1, 2] }, { name: "y", values: [3, 4] }] }) as any;
    expect(c.series).toHaveLength(2);
  });
  it("slide trống vẫn có một chuỗi để trình sửa có ô điền", () => {
    const c = sanitizeLayoutConfig("chart", {}) as any;
    expect(c.series).toEqual([{ name: "", values: [] }]);
  });
  it("máy chủ giữ ghi chú giảng khi lọc", () => {
    const c = normalizeContentSlideConfig({ ...emptyLayoutConfig("chart"), labels: ["A", "B"], series: [{ name: "", values: [1, 2] }], presenterNote: "Nói chậm." }) as any;
    expect(c.presenterNote).toBe("Nói chậm.");
    expect(c.series[0].values).toEqual([1, 2]);
  });
});

describe("padForEditing — ô sửa", () => {
  it("biểu đồ: số thành chữ kiểu Việt Nam, đủ ít nhất 2 dòng", () => {
    const d = padForEditing("chart", { layout: "chart", labels: ["A"], series: [{ name: "", values: [3.2] }] });
    expect(d.labels).toEqual(["A", ""]);
    expect(d.series[0].values).toEqual(["3,2", ""]);
    // Lưu lại không đổi giá trị.
    expect((sanitizeLayoutConfig("chart", { ...d, labels: ["A", "B"], series: [{ name: "", values: ["3,2", "1.250"] }] }) as any).series[0].values).toEqual([3.2, 1250]);
  });
  it("bảng: ít nhất 2 cột và 1 dòng, các dòng cùng số cột", () => {
    const d = padForEditing("table", { layout: "table", head: ["A"], rows: [] });
    expect(d.head).toEqual(["A", ""]);
    expect(d.rows).toEqual([["", ""]]);
  });
});

describe("convertLayoutConfig — đổi bố cục giữ dữ liệu", () => {
  const chart = sanitizeLayoutConfig("chart", {
    title: "Điểm trước và sau",
    chartType: "bar",
    labels: ["Lớp A", "Lớp B"],
    series: [{ name: "Trước", values: [6.2, 5.8] }, { name: "Sau", values: [7.4, 6.9] }],
    unit: "điểm",
    source: "Báo cáo",
  });
  it("biểu đồ → bảng → biểu đồ: nhãn, tên chuỗi, số và nguồn quay về như cũ", () => {
    const t = convertLayoutConfig(chart, "table") as any;
    expect(t.head).toEqual(["", "Trước", "Sau"]);
    expect(t.rows).toEqual([["Lớp A", "6,2", "7,4"], ["Lớp B", "5,8", "6,9"]]);
    expect(t.source).toBe("Báo cáo");
    const back = convertLayoutConfig(t, "chart") as any;
    expect(back.labels).toEqual(["Lớp A", "Lớp B"]);
    expect(back.series).toEqual([{ name: "Trước", values: [6.2, 5.8] }, { name: "Sau", values: [7.4, 6.9] }]);
  });
  it("đơn vị % đi theo qua bảng", () => {
    const pct = sanitizeLayoutConfig("chart", { labels: ["T1", "T2"], series: [{ name: "", values: [62, 84] }], unit: "%" });
    const t = convertLayoutConfig(pct, "table") as any;
    expect(t.rows).toEqual([["T1", "62%"], ["T2", "84%"]]);
    expect((convertLayoutConfig(t, "chart") as any).unit).toBe("%");
  });
  it("Số liệu ↔ Biểu đồ: con số thành cột, câu giải thích thành nhãn", () => {
    const stats = sanitizeLayoutConfig("stats", { title: "Kết quả", items: [{ heading: "62%", body: "Tuần đầu" }, { heading: "84%", body: "Tuần sáu" }] });
    const c = convertLayoutConfig(stats, "chart") as any;
    expect(c.labels).toEqual(["Tuần đầu", "Tuần sáu"]);
    expect(c.series[0].values).toEqual([62, 84]);
    expect(c.unit).toBe("%");
    const s = convertLayoutConfig(c, "stats") as any;
    expect(s.items).toEqual([{ heading: "62%", body: "Tuần đầu" }, { heading: "84%", body: "Tuần sáu" }]);
  });
  it("So sánh hai cột → bảng giữ hai cột", () => {
    const cmp = sanitizeLayoutConfig("compare", {
      title: "Hai cách",
      columns: [{ heading: "Cũ", points: ["a", "b"], note: "chậm", tone: "bad" }, { heading: "Mới", points: ["c"], note: "nhanh", tone: "good" }],
    });
    const t = convertLayoutConfig(cmp, "table") as any;
    expect(t.head).toEqual(["Cũ", "Mới"]);
    expect(t.rows).toEqual([["a", "c"], ["b", ""], ["chậm", "nhanh"]]);
  });
  it("bảng → Ba thẻ: mỗi dòng một thẻ, ô sau ghép kèm tên cột", () => {
    const t = sanitizeLayoutConfig("table", { title: "T", head: ["Hình thức", "Thời điểm"], rows: [["Viết tay", "Sau một tuần"], ["Tự động", "Ngay"]] });
    const c = convertLayoutConfig(t, "cards") as any;
    expect(c.items[0]).toMatchObject({ heading: "Viết tay", body: "Thời điểm: Sau một tuần" });
    expect(c.title).toBe("T");
  });
  it("bố cục chữ → biểu đồ: giữ nhãn, ô số để trống cho giảng viên điền", () => {
    const cards = sanitizeLayoutConfig("cards", { title: "Ba ý", items: [{ heading: "A", body: "x" }, { heading: "B", body: "y" }] });
    const c = convertLayoutConfig(cards, "chart") as any;
    expect(c.labels).toEqual(["A", "B"]);
    expect(c.series[0].values).toEqual([null, null]);
  });
});

describe("tách bảng dài và cảnh báo Slide dài", () => {
  it("bảng từ 2 dòng tách đôi, slide sau lặp hàng tiêu đề", () => {
    const t = { ...sanitizeLayoutConfig("table", { title: "Bảng", head: ["A", "B"], rows: [["1", "2"], ["3", "4"], ["5", "6"]] }), outlineId: "o1" };
    const pair = splitSlideConfig(t)!;
    expect((pair[0] as any).rows).toHaveLength(2);
    expect((pair[1] as any).rows).toEqual([["5", "6"]]);
    expect((pair[1] as any).head).toEqual(["A", "B"]);
    expect((pair[1] as any).title).toBe("Bảng (tiếp)");
    expect((pair[1] as any).outlineId).toBeUndefined();
  });
  it("bảng quá nhiều chữ thì báo \"Bảng\"; bảng ngắn thì không", () => {
    const long = Array.from({ length: 6 }, () => Array.from({ length: 5 }, () => "một ô có khá nhiều chữ để chiếm hai ba dòng"));
    expect(layoutTextProblems("table", { title: "T", head: ["A", "B", "C", "D", "E"], rows: long })).toContain("Bảng");
    expect(layoutTextProblems("table", { title: "T", head: ["A", "B"], rows: [["1", "2"]] })).toEqual([]);
  });
  it("khung dữ liệu nhỏ lại khi tiêu đề hai dòng và có nguồn", () => {
    const one = dataSlideMetrics({ title: "Ngắn" }).boxH;
    const two = dataSlideMetrics({ title: "Một tiêu đề khá dài để phải xuống hai dòng trên khung slide của bài giảng", source: "X" }).boxH;
    expect(two).toBeLessThan(one);
  });
});

// ── AI: chỉ vẽ bảng, biểu đồ khi số có trong tài liệu ──────────────────────

const os = (layout: OutlineSlide["layout"], points: string[] = []): OutlineSlide => ({ id: "o1", kind: "content", layout, title: "Tỉ lệ hoàn thành", points });
const SOURCE = "Tỉ lệ hoàn thành bài tập là 62% ở tuần đầu, 75% ở tuần thứ tư và 84% ở tuần thứ sáu. Lớp có 1.250 học viên.";
const found = numbersInText(SOURCE);
const chartDraft = (values: number[]) => ({
  index: 0,
  title: "Tỉ lệ hoàn thành tăng qua sáu tuần.",
  chart: { type: "bar", labels: ["Tuần 1", "Tuần 4", "Tuần 6"], series: [{ name: "", values }], unit: "%" },
  source: "",
  notes: "Nhấn mạnh xu hướng.",
});

describe("draftToSlide — Biểu đồ", () => {
  it("mọi số có trong tài liệu: giữ biểu đồ", () => {
    const g = draftToSlide(os("chart", ["Tuần 1: 62%", "Tuần 6: 84%"]), chartDraft([62, 75, 84]), "", found);
    expect(g.usedFallback).toBe(false);
    expect(g.config.layout).toBe("chart");
    expect((g.config as any).series[0].values).toEqual([62, 75, 84]);
    expect(g.config.presenterNote).toBe("Nhấn mạnh xu hướng.");
  });
  it("một số bịa (70): bỏ biểu đồ, rơi về Số liệu từ dàn ý", () => {
    const g = draftToSlide(os("chart", ["Tuần 1: 62%", "Tuần 6: 84%"]), chartDraft([62, 70, 84]), "", found);
    expect(g.usedFallback).toBe(true);
    expect(g.config.layout).toBe("stats");
    expect((g.config as any).items.map((i: any) => i.heading)).toEqual(["62%", "84%"]);
  });
  it("dàn ý cũng thiếu số: rơi tiếp về Ba thẻ", () => {
    const g = draftToSlide(os("chart", ["Tỉ lệ tăng đều.", "Lớp sau tốt hơn."]), chartDraft([62, 70, 84]), "", found);
    expect(g.config.layout).toBe("cards");
  });
  it("không có tài liệu: biểu đồ luôn rơi về bố cục khác", () => {
    expect(draftToSlide(os("chart"), chartDraft([62, 75, 84]), "").config.layout).not.toBe("chart");
  });
  it("biểu đồ thiếu số (dưới 2 số) coi như hỏng", () => {
    const d = chartDraft([62]);
    expect(draftToSlide(os("chart"), d, "", found).usedFallback).toBe(true);
  });
  it("không có bản nháp: dựng từ dàn ý bằng Số liệu, không bao giờ dựng biểu đồ chưa đối chiếu", () => {
    expect(configFromOutline(os("chart", ["Tuần 1: 62%", "Tuần 6: 84%"]), "", undefined, found).config.layout).toBe("stats");
    expect(configFromOutline(os("table", ["Bảng so sánh ba hình thức."]), "").config.layout).toBe("image");
  });
});

describe("draftToSlide — Bảng", () => {
  const table = (cell: string) => ({
    index: 0,
    title: "So sánh hai lớp.",
    table: { head: ["Lớp", "Tỉ lệ"], rows: [["Tuần đầu", "62%"], ["Tuần sáu", cell]] },
  });
  it("ô số có trong tài liệu, ô chữ tự do: giữ bảng", () => {
    const g = draftToSlide(os("table"), table("84%"), "", found);
    expect(g.config.layout).toBe("table");
    expect((g.config as any).rows[1]).toEqual(["Tuần sáu", "84%"]);
  });
  it("bảng toàn chữ vẫn được (không có số để bịa)", () => {
    const g = draftToSlide(os("table"), { index: 0, title: "Hai cách.", table: { head: ["Cách", "Ưu điểm"], rows: [["Viết tay", "Chi tiết"]] } }, "");
    expect(g.config.layout).toBe("table");
  });
  it("một ô có số bịa: bỏ bảng", () => {
    const g = draftToSlide(os("table", ["Bảng so sánh tỉ lệ."]), table("90%"), "", found);
    expect(g.usedFallback).toBe(true);
    expect(g.config.layout).toBe("image");
  });
  it("dataNumbersVerified không kiểm hàng tiêu đề và nhãn (chúng gọi tên)", () => {
    expect(dataNumbersVerified("table", { head: ["Năm 2031"], rows: [["84%"]] }, found)).toBe(true);
    expect(dataNumbersVerified("chart", { labels: ["Tuần 9"], series: [{ name: "", values: [84] }] }, found)).toBe(true);
  });
});

describe("generateDeckSlides truyền tài liệu xuống bước kiểm tra số", () => {
  it("cùng bản nháp: có tài liệu thì giữ biểu đồ, không có thì rơi về Ba thẻ (dàn ý cũng không được đối chiếu)", async () => {
    const outline = [os("chart", ["Tuần 1: 62%", "Tuần 6: 84%"])];
    const run = (sourceText?: string) =>
      generateDeckSlides({ outline, sourceText, isFatal: () => false, generateBatch: async () => [chartDraft([62, 75, 84])] });
    expect((await run(SOURCE)).slides[0]!.config.layout).toBe("chart");
    expect((await run()).slides[0]!.config.layout).toBe("cards");
  });
});

describe("draftToSlide — Số liệu", () => {
  const statsDraft = (...headings: string[]) => ({
    index: 0,
    title: "Tỉ lệ hoàn thành tăng dần.",
    items: headings.map((heading, i) => ({ heading, body: `Mốc ${i + 1}` })),
    notes: "Đọc chậm từng số.",
  });
  it("mọi con số có trong tài liệu (kể cả 1.250 viết kiểu Việt Nam): giữ Số liệu", () => {
    const g = draftToSlide(os("stats"), statsDraft("62%", "84%", "1.250"), "", found);
    expect(g.usedFallback).toBe(false);
    expect(g.config.layout).toBe("stats");
    expect((g.config as any).items.map((i: any) => i.heading)).toEqual(["62%", "84%", "1.250"]);
  });
  it("con số không phải số (\"Gấp đôi\") thì không có gì để đối chiếu", () => {
    expect(draftToSlide(os("stats"), statsDraft("62%", "Gấp đôi"), "", found).config.layout).toBe("stats");
  });
  it("một con số bịa (91%): bỏ bản nháp, dựng Số liệu từ dàn ý nếu số dàn ý có trong tài liệu", () => {
    const g = draftToSlide(os("stats", ["Tuần đầu: 62%", "Tuần sáu: 84%"]), statsDraft("62%", "91%"), "", found);
    expect(g.usedFallback).toBe(true);
    expect(g.config.layout).toBe("stats");
    expect((g.config as any).items.map((i: any) => i.heading)).toEqual(["62%", "84%"]);
  });
  it("dàn ý cũng có số bịa: rơi về Ba thẻ", () => {
    const g = draftToSlide(os("stats", ["Tuần đầu: 62%", "Tuần sáu: 91%", "Tuần tám: 84%"]), statsDraft("62%", "91%"), "", found);
    expect(g.usedFallback).toBe(true);
    expect(g.config.layout).toBe("cards");
  });
  it("không có tài liệu: Số liệu luôn rơi về Ba thẻ", () => {
    expect(draftToSlide(os("stats", ["Tuần đầu: 62%", "Tuần sáu: 84%"]), statsDraft("62%", "84%"), "").config.layout).toBe("cards");
    expect(configFromOutline(os("stats", ["Tuần đầu: 62%", "Tuần sáu: 84%"]), "").config.layout).toBe("cards");
  });
  it("dataNumbersVerified kiểm con số lớn, không kiểm câu giải thích bên dưới", () => {
    expect(dataNumbersVerified("stats", { items: [{ heading: "84%", body: "Năm 2031 có 7 lớp" }] }, found)).toBe(true);
    expect(dataNumbersVerified("stats", { items: [{ heading: "84%" }, { heading: "3/4" }] }, found)).toBe(false);
  });
});

describe("proposalFromDraft — Nhờ AI sửa slide biểu đồ", () => {
  const current = { config: { ...sanitizeLayoutConfig("chart", { title: "Điểm", labels: ["A", "B"], series: [{ name: "", values: [6.2, 7.4] }] }), outlineId: "o1", aiGenerated: true } };
  it("giữ số giảng viên đã nhập dù tài liệu không có", () => {
    const p = proposalFromDraft("shorter", current, { index: 0, title: "Điểm tăng.", chart: { type: "bar", labels: ["A", "B"], series: [{ name: "", values: [6.2, 7.4] }], unit: "" } }, "");
    expect(p?.config.layout).toBe("chart");
  });
  it("AI thêm số mới thì không đề xuất", () => {
    const p = proposalFromDraft("shorter", current, { index: 0, title: "Điểm tăng.", chart: { type: "bar", labels: ["A", "B"], series: [{ name: "", values: [6.2, 9.9] }], unit: "" } }, "");
    expect(p).toBeNull();
  });
});

describe("proposalFromDraft — Nhờ AI sửa slide Số liệu", () => {
  const current = { config: { ...sanitizeLayoutConfig("stats", { title: "Điểm", items: [{ heading: "6,2", body: "Lớp A" }, { heading: "7,4", body: "Lớp B" }] }), outlineId: "o1", aiGenerated: true } };
  const draft = (b: string) => ({ index: 0, title: "Điểm tăng.", items: [{ heading: "6,2", body: "Lớp A" }, { heading: b, body: "Lớp B" }] });
  it("giữ số giảng viên đã nhập dù tài liệu không có", () => {
    expect(proposalFromDraft("shorter", current, draft("7,4"), "")?.config.layout).toBe("stats");
  });
  it("AI thêm số mới thì không đề xuất; số có trong tài liệu thì được", () => {
    expect(proposalFromDraft("shorter", current, draft("9,9"), "")).toBeNull();
    expect(proposalFromDraft("shorter", current, draft("84%"), SOURCE)?.config.layout).toBe("stats");
  });
});

describe("demoteUnbackedCharts — kiểm ngay ở dàn ý", () => {
  it("đủ hai số có trong tài liệu thì giữ; thiếu thì đổi sang Chữ và hình và báo", () => {
    const ok = { ...os("chart", ["Tuần 1: 62%", "Tuần 6: 84%"]) };
    const fake = { ...os("chart", ["Tuần 1: 62%", "Tuần 6: 91%"]), id: "o2" };
    const few = { ...os("chart", ["Tỉ lệ tăng đều."]), id: "o3" };
    const w = demoteUnbackedCharts({ slides: [ok, fake, few] }, SOURCE);
    expect([ok.layout, fake.layout, few.layout]).toEqual(["chart", "image", "image"]);
    expect(w).toHaveLength(2);
    expect(w[0]).toContain("Chữ và hình");
  });
});
