import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import type { ExamResultRow } from "@feedbackme/core-lms";
import {
  buildExamResultsWorkbook,
  contentDisposition,
  examResultsFilename,
} from "./examResultsWorkbook";

function row(over: Partial<ExamResultRow>): ExamResultRow {
  return {
    attemptId: "a1",
    displayName: "Nguyễn Văn A",
    identifier: "a@example.com",
    status: "submitted",
    score: 3,
    scorePct: 50,
    submittedAt: "2026-08-27T04:10:00.000Z", // 11:10 giờ Việt Nam
    sessionId: "s1",
    sessionTitle: "Ca sáng",
    roomId: null,
    roomName: "Phòng 1",
    needsGrading: false,
    ...over,
  };
}

async function readBack(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return wb;
}

const exportedAt = new Date("2026-10-14T03:00:00.000Z");

describe("buildExamResultsWorkbook", () => {
  it("có hai sheet đúng tên, tiêu đề cột tiếng Việt", async () => {
    const buf = await buildExamResultsWorkbook({
      examTitle: "Kỹ năng mềm 10 phút",
      sessionTitle: null,
      exportedAt,
      questions: [{ number: 1, points: 1 }, { number: 2, points: 2 }],
      rows: [{ row: row({}), cells: ["Đúng", "1/2"] }],
    });
    const wb = await readBack(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Tổng hợp", "Theo câu"]);

    const summary = wb.getWorksheet("Tổng hợp")!;
    expect(summary.getRow(5).getCell(2).value).toBe("Thí sinh / Học viên");
    expect(summary.getRow(5).getCell(10).value).toBe("Trạng thái");
    expect(summary.getCell("A1").value).toBe("Bảng điểm: Kỹ năng mềm 10 phút");

    const perQ = wb.getWorksheet("Theo câu")!;
    expect(perQ.getRow(1).getCell(3).value).toBe("Câu 1 (tối đa 1đ)");
    expect(perQ.getRow(1).getCell(4).value).toBe("Câu 2 (tối đa 2đ)");
  });

  it("điểm và tỉ lệ là số thật, tỉ lệ có định dạng %", async () => {
    const buf = await buildExamResultsWorkbook({
      examTitle: "Đề",
      sessionTitle: null,
      exportedAt,
      questions: [{ number: 1, points: 1 }],
      rows: [{ row: row({ score: 3, scorePct: 50 }), cells: ["Đúng"] }],
    });
    const ws = (await readBack(buf)).getWorksheet("Tổng hợp")!;
    const data = ws.getRow(6);
    expect(data.getCell(7).value).toBe(3);
    expect(data.getCell(9).value).toBe(0.5);
    expect(data.getCell(9).numFmt).toBe("0.0%");
  });

  it("dòng chưa làm để trống điểm và ghi 'Chưa làm'", async () => {
    const buf = await buildExamResultsWorkbook({
      examTitle: "Đề",
      sessionTitle: null,
      exportedAt,
      questions: [{ number: 1, points: 1 }],
      rows: [
        {
          row: row({
            attemptId: null,
            status: "not_started",
            score: null,
            scorePct: null,
            submittedAt: null,
            displayName: "Trần B",
          }),
          cells: ["—"],
        },
      ],
    });
    const ws = (await readBack(buf)).getWorksheet("Tổng hợp")!;
    const data = ws.getRow(6);
    expect(data.getCell(7).value).toBe("");
    expect(data.getCell(10).value).toBe("Chưa làm");
  });

  it("bài còn câu chờ chấm không được ghi là Đã chấm", async () => {
    const buf = await buildExamResultsWorkbook({
      examTitle: "Đề",
      sessionTitle: null,
      exportedAt,
      questions: [{ number: 1, points: 1 }],
      rows: [{ row: row({ needsGrading: true }), cells: ["Chờ chấm"] }],
    });
    const wb = await readBack(buf);
    expect(wb.getWorksheet("Tổng hợp")!.getRow(6).getCell(10).value).toBe(
      "Còn câu chờ chấm",
    );
    expect(wb.getWorksheet("Theo câu")!.getRow(2).getCell(3).value).toBe("Chờ chấm");
  });

  it("giờ nộp hiển thị theo giờ Việt Nam, cùng định dạng với các trang khác", async () => {
    const buf = await buildExamResultsWorkbook({
      examTitle: "Đề",
      sessionTitle: null,
      exportedAt,
      questions: [],
      rows: [{ row: row({}), cells: [] }],
    });
    const ws = (await readBack(buf)).getWorksheet("Tổng hợp")!;
    expect(ws.getRow(6).getCell(6).value).toBe("11:10 27/08/2026");
  });

  it("freeze dòng tiêu đề để cuộn không mất tên cột", async () => {
    const buf = await buildExamResultsWorkbook({
      examTitle: "Đề",
      sessionTitle: null,
      exportedAt,
      questions: [{ number: 1, points: 1 }],
      rows: [{ row: row({}), cells: ["Đúng"] }],
    });
    const wb = await readBack(buf);
    const view = wb.getWorksheet("Tổng hợp")!.views[0] as { state?: string; ySplit?: number };
    expect(view.state).toBe("frozen");
    expect(view.ySplit).toBe(5);
  });
});

describe("examResultsFilename", () => {
  it("giữ dấu tiếng Việt, bỏ ký tự cấm trong tên file", () => {
    expect(
      examResultsFilename("Bảng điểm", "Kỹ năng mềm: 10 phút/?", new Date("2026-08-27T04:10:00Z"), "xlsx"),
    ).toBe("Bảng điểm - Kỹ năng mềm 10 phút - 27-08-2026.xlsx");
  });
});

describe("contentDisposition", () => {
  it("có cả bản ASCII lẫn bản UTF-8 cho tên tiếng Việt", () => {
    const h = contentDisposition("Bảng điểm - Đề 1.xlsx");
    expect(h).toContain('filename="Bang diem - De 1.xlsx"');
    expect(h).toContain(
      "filename*=UTF-8''" + encodeURIComponent("Bảng điểm - Đề 1.xlsx"),
    );
  });
});
