import ExcelJS from "exceljs";
import type { SurveyExport } from "@feedbackme/core-lms";
import { formatDateTime } from "./datetime";

/**
 * File Excel "Câu trả lời khảo sát" (docs/tieu-chi/de-thi-khao-sat.md AC7).
 *
 * Hai sheet:
 *   - Câu trả lời: mỗi lượt nộp một dòng, mỗi câu một cột (tiêu đề = mã câu).
 *     Lựa chọn ghi số thứ tự theo thứ tự soạn, thang trượt ghi số, câu chữ ghi
 *     nguyên văn; bỏ trống để ô trống. Số ghi thành số thật để phân tích ngay.
 *   - Từ điển câu hỏi: mã câu, phần, lần đo, dạng câu, nội dung, giá trị.
 */

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

const PHASE_LABEL: Record<string, string> = { pre: "Lần trước", post: "Lần sau" };

const TYPE_LABEL: Record<string, string> = {
  mcq: "Một lựa chọn",
  multi: "Nhiều lựa chọn",
  slider: "Thang trượt",
  short_answer: "Trả lời ngắn",
  essay: "Trả lời dài",
};

const FIXED_HEADERS = [
  "Họ tên",
  "Email",
  "Mã sinh viên",
  "Lớp",
  "Lần đo",
  "Ca",
  "Bắt đầu",
  "Nộp lúc",
  "Trạng thái",
];

export async function buildSurveyExportWorkbook(data: SurveyExport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Limio";
  wb.created = new Date();

  const ws = wb.addWorksheet("Câu trả lời", { views: [{ state: "frozen", xSplit: 1, ySplit: 1 }] });
  const header = ws.addRow([...FIXED_HEADERS, ...data.columns.map((c) => c.header)]);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
  });
  for (const r of data.rows) {
    ws.addRow([
      r.name,
      r.email,
      r.studentCode,
      r.className,
      r.phase ? PHASE_LABEL[r.phase] : "",
      r.sessionLabel,
      formatDateTime(r.startedAt),
      r.submittedAt ? formatDateTime(r.submittedAt) : "",
      r.status,
      // null → ô trống (không ghi "—" hay 0: người phân tích phải phân biệt được bỏ trống).
      ...r.cells.map((c) => (c === null ? null : c)),
    ]);
  }
  ws.getColumn(1).width = 26;
  ws.getColumn(2).width = 28;
  for (let i = 3; i <= FIXED_HEADERS.length; i++) ws.getColumn(i).width = 14;
  data.columns.forEach((c, i) => {
    const col = ws.getColumn(FIXED_HEADERS.length + 1 + i);
    col.width = c.type === "essay" || c.type === "short_answer" ? 40 : 8;
  });

  const dict = wb.addWorksheet("Từ điển câu hỏi", { views: [{ state: "frozen", ySplit: 1 }] });
  const dh = dict.addRow(["Mã câu", "Phần", "Lần đo", "Dạng câu", "Nội dung câu", "Giá trị"]);
  dh.font = { bold: true };
  dh.eachCell((cell) => {
    cell.fill = HEADER_FILL;
  });
  for (const c of data.columns) {
    dict.addRow([
      c.header,
      c.partTitle ?? "",
      c.phase ? PHASE_LABEL[c.phase] : "Cả hai lần",
      TYPE_LABEL[c.type] ?? c.type,
      c.prompt,
      c.legend,
    ]);
  }
  dict.getColumn(1).width = 10;
  dict.getColumn(2).width = 30;
  dict.getColumn(3).width = 12;
  dict.getColumn(4).width = 16;
  dict.getColumn(5).width = 70;
  dict.getColumn(6).width = 60;
  dict.getColumn(5).alignment = { wrapText: true, vertical: "top" };
  dict.getColumn(6).alignment = { wrapText: true, vertical: "top" };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
