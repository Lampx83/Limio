import { describe, expect, it } from "vitest";
import {
  addRow,
  applyRedraw,
  canApply,
  canRedraw,
  editCell,
  initRedraw,
  liveImageFile,
  pendingRows,
  previewChart,
  removeRow,
  restoreImage,
  sanitizeChartReading,
  setChartType,
  toggleRow,
  type ChartReading,
} from "./limioLiveChartFromImage";

const aiRaw = {
  isChart: true,
  chartType: "bar",
  title: "Tỉ lệ SV hoàn thành học phần (%)",
  unit: "%",
  labels: ["2021", "2022", "2023"],
  series: [{ name: "Hoàn thành", values: [62, 68, 71.5], printed: [true, true, false] }],
};

const reading = (): ChartReading => {
  const r = sanitizeChartReading(aiRaw);
  if (!r.ok) throw new Error(r.reason);
  return r.reading;
};

const imageSlide = {
  layout: "image",
  title: "Tỉ lệ sinh viên hoàn thành học phần",
  bullets: ["Tỉ lệ tăng đều qua năm năm.", "", "Năm 2023 bắt đầu dùng học liệu có phản hồi."],
  imageUrl: "/api/limio-live-media/u1-abc.png",
  imageFit: "contain",
  presenterNote: "Hỏi lớp vì sao tăng.",
  outlineId: "o-7",
};

describe("canRedraw (V1)", () => {
  it("chỉ slide Chữ và hình có hình lưu trong Limio", () => {
    expect(canRedraw(imageSlide)).toBe(true);
    expect(liveImageFile(imageSlide.imageUrl)).toBe("u1-abc.png");
    expect(canRedraw({ ...imageSlide, imageUrl: "https://example.com/a.png" })).toBe(false);
    expect(canRedraw({ ...imageSlide, imageUrl: "" })).toBe(false);
    expect(canRedraw({ ...imageSlide, imageUrl: "/api/limio-live-media/../x.png" })).toBe(false);
    expect(canRedraw({ ...imageSlide, layout: "cards" })).toBe(false);
  });
});

describe("sanitizeChartReading (V4)", () => {
  it("nhận kết quả hợp lệ: loại, nhãn, số, cờ ghi trên hình", () => {
    const r = reading();
    expect(r).toEqual({
      chartType: "bar",
      title: "Tỉ lệ SV hoàn thành học phần (%)",
      unit: "%",
      labels: ["2021", "2022", "2023"],
      series: [{ name: "Hoàn thành", values: [62, 68, 71.5], printed: [true, true, false] }],
    });
  });

  it("đọc số viết bằng chữ, căn số theo nhãn, đổi tên loại thường gặp", () => {
    const r = sanitizeChartReading({ ...aiRaw, chartType: "doughnut", series: [{ name: "A", values: ["62", "68,5"], printed: [true] }] });
    expect(r).toMatchObject({ ok: true, reading: { chartType: "donut", series: [{ values: [62, 68.5, null], printed: [true, false, false] }] } });
  });

  it("từ chối: không phải biểu đồ, JSON hỏng, quá nhiều nhãn hoặc chuỗi, không có số nào", () => {
    expect(sanitizeChartReading({ isChart: false })).toEqual({ ok: false, reason: "not_chart" });
    expect(sanitizeChartReading("xin chào")).toEqual({ ok: false, reason: "not_chart" });
    expect(sanitizeChartReading({ ...aiRaw, chartType: "radar" })).toEqual({ ok: false, reason: "not_chart" });
    expect(sanitizeChartReading({ ...aiRaw, labels: Array.from({ length: 9 }, (_, i) => `N${i}`) })).toEqual({ ok: false, reason: "too_many_labels" });
    expect(sanitizeChartReading({ ...aiRaw, labels: ["Một"] })).toEqual({ ok: false, reason: "not_chart" });
    const three = [1, 2, 3].map((k) => ({ name: `S${k}`, values: [1, 2, 3], printed: [] }));
    expect(sanitizeChartReading({ ...aiRaw, series: three })).toEqual({ ok: false, reason: "too_many_series" });
    expect(sanitizeChartReading({ ...aiRaw, series: [{ name: "A", values: [null, "x", Infinity] }] })).toEqual({ ok: false, reason: "not_chart" });
  });
});

describe("đối chiếu theo dòng (V5–V8)", () => {
  it("mọi dòng bắt đầu chưa đối chiếu; tiêu đề giữ tiêu đề slide; số ước lượng được đánh dấu", () => {
    const d = initRedraw(reading(), imageSlide.title);
    expect(d.title).toBe("Tỉ lệ sinh viên hoàn thành học phần");
    expect(d.rows.map((r) => [r.label, r.values, r.ok, r.estimated])).toEqual([
      ["2021", ["62"], false, [false]],
      ["2022", ["68"], false, [false]],
      ["2023", ["71,5"], false, [true]],
    ]);
    expect(pendingRows(d)).toBe(3);
    expect(canApply(d)).toBe(false);
  });

  it("Khớp, sửa một ô, bỏ khớp; thêm, xoá dòng, đổi loại không bỏ khớp dòng khác", () => {
    let d = initRedraw(reading(), "T");
    d = toggleRow(d, 0);
    d = editCell(d, 2, { value: [0, "72"] });
    expect(d.rows.map((r) => r.ok)).toEqual([true, false, true]);
    expect(d.rows[2]!.estimated).toEqual([false]);
    d = setChartType(d, "line");
    d = addRow(d);
    expect(d.rows.map((r) => r.ok)).toEqual([true, false, true, true]);
    d = removeRow(d, 3);
    d = toggleRow(d, 0);
    expect(d.rows.map((r) => r.ok)).toEqual([false, false, true]);
    expect(pendingRows(d)).toBe(2);
  });

  it("xem trước chỉ có số của dòng đã đối chiếu; tròn chỉ vẽ khi đã đối chiếu hết", () => {
    let d = toggleRow(initRedraw(reading(), "T"), 1);
    expect(previewChart(d)).toMatchObject({ chartType: "bar", labels: ["2021", "2022", "2023"], series: [{ values: [null, 68, null] }] });
    d = setChartType(d, "pie");
    expect(previewChart(d)).toBeNull();
  });

  it("nút thay chỉ mở khi mọi dòng đã đối chiếu", () => {
    let d = initRedraw(reading(), "T");
    expect(applyRedraw(d, imageSlide)).toBeNull();
    d = toggleRow(toggleRow(d, 0), 1);
    expect(canApply(d)).toBe(false);
    d = toggleRow(d, 2);
    expect(canApply(d)).toBe(true);
  });
});

describe("thay hình và trả lại hình (V9, V11)", () => {
  const done = () => [0, 1, 2].reduce((d, i) => toggleRow(d, i), initRedraw(reading(), imageSlide.title));

  it("slide thành Biểu đồ đúng số đã đối chiếu; giữ ghi chú và meta; ý cũ sang slide (tiếp)", () => {
    const out = applyRedraw(editCell(done(), 0, { value: [0, "62,5"] }), imageSlide)!;
    expect(out.chart).toMatchObject({
      layout: "chart",
      title: "Tỉ lệ sinh viên hoàn thành học phần",
      chartType: "bar",
      labels: ["2021", "2022", "2023"],
      series: [{ name: "Hoàn thành", values: [62.5, 68, 71.5] }],
      unit: "%",
      presenterNote: "Hỏi lớp vì sao tăng.",
      outlineId: "o-7",
      fromImage: "/api/limio-live-media/u1-abc.png",
    });
    expect(out.chart.source ?? "").toBe("");
    expect(out.chart).not.toHaveProperty("imageUrl");
    expect(out.cont).toMatchObject({
      layout: "image",
      title: "Tỉ lệ sinh viên hoàn thành học phần (tiếp)",
      bullets: ["Tỉ lệ tăng đều qua năm năm.", "Năm 2023 bắt đầu dùng học liệu có phản hồi."],
    });
    expect(out.cont).not.toHaveProperty("imageUrl");
    expect(out.cont).not.toHaveProperty("presenterNote");
  });

  it("slide cũ không có ý thì không tạo slide (tiếp)", () => {
    expect(applyRedraw(done(), { ...imageSlide, bullets: ["", " "] })!.cont).toBeNull();
  });

  it("trả lại hình: về Chữ và hình với hình gốc, tiêu đề hiện tại, bỏ khoá fromImage", () => {
    const { chart } = applyRedraw(done(), imageSlide)!;
    const back = restoreImage({ ...chart, title: "Tiêu đề mới" })!;
    expect(back).toMatchObject({ layout: "image", title: "Tiêu đề mới", imageUrl: "/api/limio-live-media/u1-abc.png", presenterNote: "Hỏi lớp vì sao tăng." });
    expect(back).not.toHaveProperty("fromImage");
    expect(restoreImage({ layout: "chart", title: "x" })).toBeNull();
  });
});
