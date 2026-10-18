import { describe, expect, it } from "vitest";
import {
  cellNumbersInSource,
  chartAltText,
  chartLabelLimit,
  formatValue,
  hasNumber,
  niceTicks,
  numbersInText,
  numericColumns,
  numToInput,
  parseClipboardGrid,
  parseNum,
  pasteIntoChart,
  pasteIntoTable,
  sourceLine,
  spreadLabels,
  tableFontSize,
  TABLE_PAD_Y,
  TABLE_PX,
  wrapLines,
} from "./limioLiveCharts";

describe("parseNum: đọc số kiểu Việt Nam trước", () => {
  it("dấu phẩy là phần thập phân, dấu chấm chia nhóm nghìn", () => {
    expect(parseNum("3,5")).toBe(3.5);
    expect(parseNum("1.250")).toBe(1250);
    expect(parseNum("12.345.678")).toBe(12345678);
    expect(parseNum("1.250,75")).toBe(1250.75);
  });
  it("vẫn đọc được số kiểu Anh khi không nhầm được", () => {
    expect(parseNum("3.5")).toBe(3.5);
    expect(parseNum("0.125")).toBe(0.125);
    expect(parseNum("1,250.5")).toBe(1250.5);
    expect(parseNum("1,250,000")).toBe(1250000);
  });
  it("bỏ %, khoảng trắng chia nhóm, dấu trừ kiểu chữ", () => {
    expect(parseNum("35%")).toBe(35);
    expect(parseNum("1 250")).toBe(1250);
    expect(parseNum("−4,2")).toBe(-4.2);
  });
  it("trống là null, không phải số là NaN", () => {
    expect(parseNum("")).toBeNull();
    expect(parseNum("  ")).toBeNull();
    expect(parseNum("abc")).toBeNaN();
    expect(parseNum("3,5 điểm")).toBeNaN();
    expect(parseNum("1.2.3")).toBeNaN();
  });
  it("số sửa trong ô đọc lại đúng giá trị (không mất phần thập phân)", () => {
    for (const v of [3.2, 1.234, 1250, 0.5, -7.25]) expect(parseNum(numToInput(v))).toBe(v);
    expect(numToInput(null)).toBe("");
  });
});

describe("formatValue", () => {
  it("định dạng Việt Nam, % ghi liền sau số, đơn vị khác không ghi", () => {
    expect(formatValue(1250)).toBe("1.250");
    expect(formatValue(6.2, "điểm")).toBe("6,2");
    expect(formatValue(84, "%")).toBe("84%");
  });
});

describe("numbersInText + hasNumber: đối chiếu số với tài liệu", () => {
  const src = "Tỉ lệ hoàn thành tăng từ 62% ở tuần đầu lên 84% ở tuần thứ sáu. Có 1.250 học viên, điểm trung bình 6,5 vào năm 2024.";
  const found = numbersInText(src);
  it("tìm thấy số bất kể cách viết", () => {
    expect(hasNumber(found, 62)).toBe(true);
    expect(hasNumber(found, 84)).toBe(true);
    expect(hasNumber(found, 1250)).toBe(true);
    expect(hasNumber(found, 6.5)).toBe(true);
    expect(hasNumber(found, 2024)).toBe(true);
  });
  it("số không có trong tài liệu thì không khớp (kể cả số làm tròn)", () => {
    expect(hasNumber(found, 70)).toBe(false);
    expect(hasNumber(found, 6)).toBe(false);
    expect(hasNumber(found, 85)).toBe(false);
  });
  it("so theo trị tuyệt đối: \"giảm 5%\" khớp −5", () => {
    expect(hasNumber(numbersInText("điểm giảm 5%"), -5)).toBe(true);
  });
  it("cụm số mơ hồ được đọc theo mọi cách", () => {
    const f = numbersInText("chi phí 1.250 đồng");
    expect(hasNumber(f, 1250)).toBe(true);
    expect(hasNumber(f, 1.25)).toBe(true);
  });
  it("ô chữ của bảng: mọi cụm số trong ô phải có trong tài liệu", () => {
    expect(cellNumbersInSource("Ngay lập tức", found)).toBe(true);
    expect(cellNumbersInSource("84%", found)).toBe(true);
    expect(cellNumbersInSource("Từ 62% lên 84%", found)).toBe(true);
    expect(cellNumbersInSource("Sau 3 tuần", found)).toBe(false);
  });
});

describe("niceTicks", () => {
  it("vạch chia tròn, phủ trọn khoảng", () => {
    expect(niceTicks(0, 220)).toEqual([0, 50, 100, 150, 200, 250]);
    expect(niceTicks(118, 220)).toEqual([100, 125, 150, 175, 200, 225]);
    const t = niceTicks(-3, 7);
    expect(t[0]).toBeLessThanOrEqual(-3);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(7);
  });
  it("khoảng rỗng hoặc hỏng vẫn có ít nhất hai vạch", () => {
    expect(niceTicks(5, 5).length).toBeGreaterThanOrEqual(2);
    expect(niceTicks(NaN, 3)).toEqual([0, 1]);
  });
});

describe("wrapLines và spreadLabels", () => {
  it("ngắt theo từ, quá số dòng thì có dấu …", () => {
    expect(wrapLines("Không thấy tiến bộ", 400, 26, 2)).toEqual(["Không thấy tiến bộ"]);
    const l = wrapLines("Một nhãn rất dài có nhiều từ để thử ngắt dòng", 150, 26, 2);
    expect(l.length).toBe(2);
    expect(l[1]!.endsWith("…")).toBe(true);
  });
  it("nhãn sát nhau được đẩy ra đủ khoảng cách, giữ thứ tự gốc, không vượt đáy", () => {
    const ys = spreadLabels([100, 110, 300], 70, 0, 400);
    expect(ys[1]! - ys[0]!).toBeGreaterThanOrEqual(70);
    expect(ys[2]).toBe(300);
    const low = spreadLabels([390, 395], 70, 0, 400);
    expect(Math.max(...low)).toBeLessThanOrEqual(400);
  });
});

describe("giới hạn hiển thị", () => {
  it("cột hai chuỗi ít nhãn hơn; tròn và thanh ngang tối đa 6", () => {
    expect(chartLabelLimit("bar", 1)).toBe(8);
    expect(chartLabelLimit("bar", 2)).toBe(6);
    expect(chartLabelLimit("line", 2)).toBe(8);
    expect(chartLabelLimit("pie", 1)).toBe(6);
    expect(chartLabelLimit("hbar", 1)).toBe(6);
  });
  it("bảng: ít chữ thì chữ lớn tới 40 px và ô giãn ra cho hết khung", () => {
    const head = ["A", "B", "C"];
    const r = tableFontSize(head, [["x", "y", "z"]], 1068, 400);
    expect(r).toMatchObject({ px: TABLE_PX.max, overflow: false });
    expect(r.padY).toBe(TABLE_PAD_Y.max);
  });
  it("bảng: đệm ô chỉ giãn trong phần chỗ còn trống, không làm bảng cao quá khung", () => {
    const head = ["Giải pháp", "Chi phí", "Thời gian", "Mức tương tác"];
    const rows = Array.from({ length: 5 }, (_, i) => [`Giải pháp ${i}`, "Trung bình", "2 tháng", "Cao"]);
    const availH = 360;
    const r = tableFontSize(head, rows, 1068, availH);
    expect(r.overflow).toBe(false);
    // 6 hàng (kể cả hàng tiêu đề) một dòng: tổng chiều cao ≤ khung
    expect(14 + 6 * (r.px * 1.25 + 2 * r.padY + 2)).toBeLessThanOrEqual(availH);
    expect(r.padY).toBeGreaterThanOrEqual(Math.floor(TABLE_PAD_Y.min));
  });
  it("bảng: cỡ chữ giảm dần đến 26 px rồi báo tràn", () => {
    const head = ["A", "B", "C"];
    const long = Array.from({ length: 6 }, () => ["một ô có khá nhiều chữ để chiếm hai dòng", "ô khác", "ô nữa cũng dài dài"]);
    const r = tableFontSize(head, long, 1068, 300);
    expect(r.px).toBe(26);
    expect(r.overflow).toBe(true);
  });
  it("cột toàn số (bỏ ô trống) để căn phải", () => {
    expect(numericColumns([["Lớp A", "6,2", ""], ["Lớp B", "7", "x"]], 3)).toEqual([false, true, false]);
  });
  it("dòng nguồn tự thêm \"Nguồn:\"", () => {
    expect(sourceLine("Báo cáo 2024")).toBe("Nguồn: Báo cáo 2024");
    expect(sourceLine("Nguồn: Bộ GD&ĐT")).toBe("Nguồn: Bộ GD&ĐT");
    expect(sourceLine("  ")).toBe("");
  });
  it("mô tả cho trình đọc màn hình nêu đủ nhãn và số", () => {
    const t = chartAltText({ chartType: "bar", labels: ["Tuần 1", "Tuần 2"], series: [{ name: "", values: [62, null] }], unit: "%" });
    expect(t).toContain("Biểu đồ cột");
    expect(t).toContain("Tuần 1 62%");
    expect(t).toContain("Tuần 2 không có số");
  });
});

describe("dán từ Excel", () => {
  it("tách theo tab và dòng; một ô đơn thì để trình duyệt dán bình thường", () => {
    expect(parseClipboardGrid("a\tb\r\nc\td\n")).toEqual([["a", "b"], ["c", "d"]]);
    expect(parseClipboardGrid("chỉ một ô")).toBeNull();
  });
  it("bảng: nở thêm dòng, cột đến giới hạn và đếm phần bị bỏ", () => {
    const grid = Array.from({ length: 9 }, (_, i) => ["a", "b", "c", "d", "e", "f"].map((x) => `${x}${i}`));
    const r = pasteIntoTable([["", ""], ["", ""]], grid, 0, 0);
    expect(r.cells.length).toBe(7); // hàng tiêu đề + 6 dòng
    expect(r.cells[0]!.length).toBe(5);
    expect(r.cells[0]![0]).toBe("a0");
    expect(r.droppedRows).toBe(2);
    expect(r.droppedCols).toBe(1);
  });
  it("biểu đồ: dòng đầu chữ thành tên chuỗi, cột thứ ba tự thêm chuỗi hai", () => {
    const grid = parseClipboardGrid("Kỹ năng\tĐầu khoá\tCuối khoá\nĐặt câu hỏi\t3,2\t4,1\nLập luận\t2,8\t3,9")!;
    const r = pasteIntoChart({ labels: ["", ""], series: [{ name: "", values: ["", ""] }] }, grid, 0, 0);
    expect(r.usedHeader).toBe(true);
    expect(r.labels).toEqual(["Đặt câu hỏi", "Lập luận"]);
    expect(r.series.map((s) => s.name)).toEqual(["Đầu khoá", "Cuối khoá"]);
    expect(r.series[1]!.values).toEqual(["4,1", "3,9"]);
  });
  it("biểu đồ: dán một cột số vào giữa chỉ đổi cột đó; thừa cột thì bỏ", () => {
    const base = { labels: ["A", "B", "C"], series: [{ name: "", values: ["1", "2", "3"] }] };
    const r = pasteIntoChart(base, [["9"], ["8"]], 1, 1);
    expect(r.series[0]!.values).toEqual(["1", "9", "8"]);
    expect(r.usedHeader).toBe(false);
    const wide = pasteIntoChart(base, [["X", "1", "2", "3", "4"]], 0, 0);
    expect(wide.droppedCols).toBe(2);
    expect(wide.series.length).toBe(2);
  });
});
