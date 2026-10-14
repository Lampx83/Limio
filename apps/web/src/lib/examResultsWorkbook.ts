import ExcelJS from "exceljs";
import type { ExamResultRow } from "@feedbackme/core-lms";
import { formatDate, formatDateTime } from "./datetime";
import { resultVerdict } from "./examResultStatus";

/**
 * File Excel "Bảng điểm" cho giáo viên.
 *
 * Hai sheet:
 *   - Tổng hợp: một dòng cho mỗi thí sinh/học viên, có điểm, tỉ lệ và trạng thái.
 *   - Theo câu: cùng thứ tự người, mỗi câu một cột, ô ghi Đúng/Sai/điểm lẻ/Chờ chấm.
 *
 * Số được ghi thành số thật (không phải chữ), tỉ lệ có định dạng %, để giáo viên
 * tự cộng, lọc, sắp xếp được ngay trong Excel.
 */

export interface ExamResultsWorkbookInput {
  examTitle: string;
  /** Null khi xuất tất cả ca. */
  sessionTitle: string | null;
  exportedAt: Date;
  questions: Array<{ number: number; points: number }>;
  /** Mỗi phần tử ứng với một dòng `row`; `cells[i]` là ô của câu thứ i. */
  rows: Array<{ row: ExamResultRow; cells: string[] }>;
}

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE2E8F0" },
};

const CELL_FILL: Record<string, string> = {
  Đúng: "FFDCFCE7",
  Sai: "FFFEE2E2",
  "Chờ chấm": "FFFEF3C7",
};

const VERDICT_FILL: Record<string, string> = {
  "Đã chấm": "FFDCFCE7",
  "Còn câu chờ chấm": "FFFEF3C7",
  "Đang làm": "FFDBEAFE",
};

const MUTED_FONT: Partial<ExcelJS.Font> = { color: { argb: "FF94A3B8" } };

export function buildExamResultsWorkbook(
  input: ExamResultsWorkbookInput,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FeedBackMe";
  wb.created = input.exportedAt;

  addSummarySheet(wb, input);
  addPerQuestionSheet(wb, input);

  return wb.xlsx.writeBuffer().then((b) => Buffer.from(b));
}

function addSummarySheet(wb: ExcelJS.Workbook, input: ExamResultsWorkbookInput) {
  const ws = wb.addWorksheet("Tổng hợp");
  const total = input.questions.reduce((s, q) => s + q.points, 0);
  const cols = [
    "STT",
    "Thí sinh / Học viên",
    "Email hoặc mã dự thi",
    "Ca thi",
    "Phòng",
    "Nộp lúc",
    "Điểm",
    `Tổng điểm`,
    "Tỉ lệ",
    "Trạng thái",
  ];
  const widths = [6, 28, 30, 24, 14, 18, 10, 12, 10, 20];

  ws.getCell("A1").value = `Bảng điểm: ${input.examTitle}`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A2").value = `Ca thi: ${input.sessionTitle ?? "Tất cả ca"}`;
  ws.getCell("A3").value =
    `Xuất lúc ${formatDateTime(input.exportedAt)} · ${input.rows.length} người · ` +
    `${input.rows.filter((x) => x.row.status !== "not_started").length} đã làm bài`;
  ws.getCell("A3").font = MUTED_FONT;

  const headerRow = 5;
  const header = ws.getRow(headerRow);
  header.values = cols;
  header.font = { bold: true };
  header.fill = HEADER_FILL;
  header.alignment = { vertical: "middle", wrapText: true };
  ws.columns = widths.map((width) => ({ width }));

  input.rows.forEach(({ row: r }, i) => {
    const v = resultVerdict(r);
    const excelRow = ws.addRow([
      i + 1,
      r.displayName,
      r.identifier ?? "",
      r.sessionTitle ?? "",
      r.roomName ?? "",
      r.submittedAt ? formatDateTime(new Date(r.submittedAt)) : "",
      r.score ?? "",
      total,
      r.scorePct != null ? r.scorePct / 100 : "",
      v.label,
    ]);
    excelRow.getCell(9).numFmt = "0.0%";
    const fill = VERDICT_FILL[v.label];
    if (fill) {
      excelRow.getCell(10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    }
  });

  ws.views = [{ state: "frozen", ySplit: headerRow }];
  if (input.rows.length > 0) {
    ws.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow + input.rows.length, column: cols.length },
    };
  }
}

function addPerQuestionSheet(wb: ExcelJS.Workbook, input: ExamResultsWorkbookInput) {
  const ws = wb.addWorksheet("Theo câu");
  const cols = [
    "STT",
    "Thí sinh / Học viên",
    ...input.questions.map((q) => `Câu ${q.number} (tối đa ${q.points}đ)`),
    "Tổng điểm",
  ];
  ws.columns = cols.map((_, i) => ({
    width: i === 0 ? 6 : i === 1 ? 28 : 16,
  }));

  const headerRow = ws.getRow(1);
  headerRow.values = cols;
  headerRow.font = { bold: true };
  headerRow.fill = HEADER_FILL;
  headerRow.alignment = { vertical: "middle", wrapText: true, horizontal: "center" };
  headerRow.height = 32;

  input.rows.forEach(({ row: r, cells }, i) => {
    const excelRow = ws.addRow([
      i + 1,
      r.displayName,
      ...cells,
      r.score ?? "",
    ]);
    cells.forEach((text, j) => {
      const cell = excelRow.getCell(j + 3);
      cell.alignment = { horizontal: "center" };
      const fill = CELL_FILL[text];
      if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      if (text === "—") cell.font = MUTED_FONT;
    });
    excelRow.getCell(cols.length).alignment = { horizontal: "center" };
  });

  ws.views = [{ state: "frozen", ySplit: 1, xSplit: 2 }];
}

/** Tên file tiếng Việt có dấu, ví dụ "Bảng điểm - Kỹ năng mềm 10 phút - 27-08-2026.xlsx". */
export function examResultsFilename(
  label: string,
  examTitle: string,
  date: Date,
  ext: "xlsx" | "csv",
): string {
  const title = examTitle.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  const stamp = formatDate(date).replace(/\//g, "-");
  return `${label} - ${title.slice(0, 80)} - ${stamp}.${ext}`;
}

/**
 * Content-Disposition có cả bản ASCII lẫn bản UTF-8 (RFC 5987), để tên có dấu
 * tải về đúng ở mọi trình duyệt.
 */
export function contentDisposition(name: string): string {
  const ascii = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
