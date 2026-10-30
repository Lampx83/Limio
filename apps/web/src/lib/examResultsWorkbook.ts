import ExcelJS from "exceljs";
import type { ExamResultRow, SessionRosterRow } from "@feedbackme/core-lms";
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
  /** "Phần 1 40% · Phần 2 60%" khi tỉ lệ điểm tính theo trọng số; null/bỏ trống khi theo tỉ lệ điểm. */
  weightsNote?: string | null;
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
    "MSSV",
    "Email hoặc mã dự thi",
    "Ca thi",
    "Phòng",
    "Nộp lúc",
    "Điểm",
    `Tổng điểm`,
    "Tỉ lệ",
    "Trạng thái",
    "Số lần chuyển tab",
  ];
  const widths = [6, 28, 14, 30, 24, 14, 18, 10, 12, 10, 20, 12];

  ws.getCell("A1").value = `Bảng điểm: ${input.examTitle}`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A2").value = `Ca thi: ${input.sessionTitle ?? "Tất cả ca"}`;
  ws.getCell("A3").value =
    `Xuất lúc ${formatDateTime(input.exportedAt)} · ${input.rows.length} người · ` +
    `${input.rows.filter((x) => x.row.status !== "not_started").length} đã làm bài`;
  ws.getCell("A3").font = MUTED_FONT;
  if (input.weightsNote) {
    ws.getCell("A4").value = `Tỉ lệ tính theo trọng số: ${input.weightsNote}. Điểm là điểm thô, giữ nguyên.`;
    ws.getCell("A4").font = MUTED_FONT;
  }

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
      r.mssv ?? "",
      r.identifier ?? "",
      r.sessionTitle ?? "",
      r.roomName ?? "",
      r.submittedAt ? formatDateTime(new Date(r.submittedAt)) : "",
      r.score ?? "",
      total,
      r.scorePct != null ? r.scorePct / 100 : "",
      v.label,
      // Người chưa vào thi để trống, không ghi 0 như thể đã thi mà không rời tab.
      r.attemptId ? (r.tabSwitchCount ?? 0) : "",
    ]);
    // MSSV giữ dạng chữ: Excel không được tự bỏ số 0 đầu.
    excelRow.getCell(3).numFmt = "@";
    excelRow.getCell(10).numFmt = "0.0%";
    const fill = VERDICT_FILL[v.label];
    if (fill) {
      excelRow.getCell(11).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
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

/** Sheet "Theo câu" chỉ cần tên và tổng điểm của mỗi người. */
type PerQuestionInput = {
  questions: Array<{ number: number; points: number }>;
  rows: Array<{ row: Pick<ExamResultRow, "displayName" | "score">; cells: string[] }>;
};

function addPerQuestionSheet(wb: ExcelJS.Workbook, input: PerQuestionInput) {
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

/**
 * Ô của một câu trên sheet "Theo câu": Đúng / Sai / điểm lẻ / Chờ chấm / — (chưa
 * có bài). Câu còn chờ chấm tay luôn ghi "Chờ chấm" dù đã có điểm tự chấm một
 * phần, vì điểm đó chưa phải điểm cuối.
 */
export function answerCell(
  ans: { autoScore: number | null; manualScore: number | null; needsGrading: boolean } | undefined,
  points: number,
): string {
  if (!ans) return "—";
  if (ans.needsGrading) return "Chờ chấm";
  const awarded = ans.manualScore ?? ans.autoScore;
  if (awarded == null) return "—";
  return awarded >= points ? "Đúng" : awarded > 0 ? `${awarded}/${points}` : "Sai";
}

export interface SessionRosterWorkbookInput {
  examTitle: string;
  sessionTitle: string;
  exportedAt: Date;
  totalPoints: number;
  /** "Phần 1 40% · Phần 2 60%" khi điểm tính theo trọng số; null khi theo tỉ lệ điểm. */
  weightsNote?: string | null;
  /** Đề chia từ 2 phần trở lên thì mỗi phần một cột điểm (điểm thô của phần). */
  sections?: Array<{ title: string; maxPoints: number; weight: number | null }>;
  questions: Array<{ number: number; points: number }>;
  /** `sectionCells[i]` là ô của phần thứ i: điểm thô, "Chờ chấm" hoặc "—". */
  rows: Array<{ row: SessionRosterRow; cells: string[]; sectionCells?: Array<number | string> }>;
}

/**
 * "Bảng điểm ca thi": mỗi dòng một thí sinh của ca (kể cả em chưa vào thi), có
 * mã lớp học / mã lớp thi. Sheet "Theo câu" cùng thứ tự người.
 */
export function buildSessionRosterWorkbook(input: SessionRosterWorkbookInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FeedBackMe";
  wb.created = input.exportedAt;

  const ws = wb.addWorksheet("Tổng hợp");
  const cols = [
    "STT",
    "Họ tên",
    "MSSV",
    "Email",
    "Mã lớp học",
    "Mã lớp thi",
    "Phòng",
    "Mã thi",
    "Trạng thái",
    "Điểm",
    "Điểm thang 10",
    "Nộp lúc",
    "Số lượt",
    "Số lần chuyển tab",
  ];
  const widths = [6, 28, 14, 30, 14, 14, 16, 12, 18, 9, 12, 18, 9, 12];
  const sections = input.sections ?? [];
  const pct = (w: number) => `${String(Math.round(w * 100) / 100).replace(".", ",")}%`;
  for (const sec of sections) {
    cols.push(`${sec.title} (tối đa ${sec.maxPoints}đ${sec.weight !== null ? `, ${pct(sec.weight)}` : ""})`);
    widths.push(18);
  }
  const done = input.rows.filter((x) => x.row.status !== "not_started").length;

  ws.getCell("A1").value = `Bảng điểm: ${input.examTitle}`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A2").value =
    `Ca thi: ${input.sessionTitle} · Tổng điểm bài thi: ${input.totalPoints} · ` +
    (input.weightsNote
      ? `Điểm thang 10 tính theo trọng số: ${input.weightsNote}, làm tròn 1 chữ số`
      : `Điểm thang 10 = điểm ÷ ${input.totalPoints} × 10, làm tròn 1 chữ số`);
  ws.getCell("A3").value =
    `Xuất lúc ${formatDateTime(input.exportedAt)} · ${input.rows.length} thí sinh · ${done} đã làm bài · ` +
    `${input.rows.length - done} chưa làm`;
  ws.getCell("A3").font = MUTED_FONT;

  const headerRow = 5;
  const header = ws.getRow(headerRow);
  header.values = cols;
  header.font = { bold: true };
  header.fill = HEADER_FILL;
  header.alignment = { vertical: "middle", wrapText: true };
  ws.columns = widths.map((width) => ({ width }));

  input.rows.forEach(({ row: r, sectionCells }, i) => {
    const v = resultVerdict(r);
    const excelRow = ws.addRow([
      i + 1,
      r.displayName,
      r.mssv ?? "",
      r.email ?? "",
      r.cohortCode ?? "",
      r.examClassCode ?? "",
      r.roomName ?? "",
      r.accessCode ?? "",
      v.label,
      r.score ?? "",
      // Từ scorePct (chỉ có khi đã chấm xong) nên bài còn câu chờ chấm để trống.
      r.scorePct != null ? Math.round(r.scorePct) / 10 : "",
      r.submittedAt ? formatDateTime(new Date(r.submittedAt)) : "",
      r.attemptCount,
      // Người chưa vào thi để trống, không ghi 0 như thể đã thi mà không rời tab.
      r.attemptId ? r.tabSwitchCount : "",
      ...sections.map((_, k) => sectionCells?.[k] ?? "—"),
    ]);
    // MSSV và mã thi giữ dạng chữ: Excel không được tự bỏ số 0 đầu.
    excelRow.getCell(3).numFmt = "@";
    excelRow.getCell(8).numFmt = "@";
    excelRow.getCell(11).numFmt = "0.0";
    const fill = VERDICT_FILL[v.label];
    if (fill) excelRow.getCell(9).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    if (r.status === "not_started") excelRow.getCell(9).font = MUTED_FONT;
  });

  ws.views = [{ state: "frozen", ySplit: headerRow, xSplit: 2 }];
  if (input.rows.length > 0) {
    ws.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow + input.rows.length, column: cols.length },
    };
  }

  addPerQuestionSheet(wb, input);

  return wb.xlsx.writeBuffer().then((b) => Buffer.from(b));
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
