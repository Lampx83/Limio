import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import type { ExamResultRow, SessionRosterRow } from "@feedbackme/core-lms";
import {
  answerCell,
  buildExamResultsWorkbook,
  buildSessionRosterWorkbook,
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

function rosterRow(over: Partial<SessionRosterRow>): SessionRosterRow {
  return {
    displayName: "An",
    mssv: null,
    email: null,
    cohortCode: null,
    examClassCode: null,
    roomName: null,
    accessCode: null,
    status: "not_started",
    attemptId: null,
    attemptCount: 0,
    score: null,
    scorePct: null,
    submittedAt: null,
    needsGrading: false,
    ...over,
  };
}

describe("buildSessionRosterWorkbook", () => {
  it("mỗi dòng một thí sinh, đủ cột mã lớp; em chưa làm vẫn có dòng; MSSV giữ số 0 đầu", async () => {
    const buf = await buildSessionRosterWorkbook({
      examTitle: "Giữa kỳ",
      sessionTitle: "Ca 1",
      exportedAt,
      totalPoints: 10,
      questions: [{ number: 1, points: 10 }],
      rows: [
        {
          row: rosterRow({
            displayName: "Nguyễn Văn An",
            mssv: "0123",
            cohortCode: "K65A",
            examClassCode: "P101",
            roomName: "P101",
            accessCode: "ABCD2345",
            status: "graded",
            score: 7,
            scorePct: 70,
            attemptCount: 2,
          }),
          cells: ["7/10"],
        },
        { row: rosterRow({ displayName: "Trần Bình" }), cells: ["—"] },
      ],
    });
    const wb = await readBack(buf);
    const ws = wb.getWorksheet("Tổng hợp")!;
    expect((ws.getRow(5).values as unknown[]).slice(1)).toEqual([
      "STT", "Họ tên", "MSSV", "Email", "Mã lớp học", "Mã lớp thi", "Phòng", "Mã thi",
      "Trạng thái", "Điểm", "Điểm thang 10", "Nộp lúc", "Số lượt",
    ]);
    const r1 = (ws.getRow(6).values as unknown[]).slice(1);
    expect(r1.slice(0, 10)).toEqual([1, "Nguyễn Văn An", "0123", "", "K65A", "P101", "P101", "ABCD2345", "Đã chấm", 7]);
    expect(r1[12]).toBe(2);
    // 7/10 điểm = 70% ⇒ 7,0 thang 10; số thật, hiện 1 chữ số thập phân.
    expect(ws.getRow(6).getCell(11).value).toBe(7);
    expect(ws.getRow(6).getCell(11).numFmt).toBe("0.0");
    expect(ws.getRow(7).getCell(11).value).toBe("");
    expect(ws.getRow(7).getCell(9).value).toBe("Chưa làm");
    expect(ws.getCell("A3").value).toContain("2 thí sinh · 1 đã làm bài · 1 chưa làm");

    const q = wb.getWorksheet("Theo câu")!;
    expect((q.getRow(2).values as unknown[]).slice(1)).toEqual([1, "Nguyễn Văn An", "7/10", 7]);
  });
});

describe("buildSessionRosterWorkbook — thang 10", () => {
  it("12/15 điểm ⇒ 8 thang 10; 2/3 điểm ⇒ 6,7 (làm tròn 1 chữ số)", async () => {
    const buf = await buildSessionRosterWorkbook({
      examTitle: "Đề",
      sessionTitle: "Ca",
      exportedAt,
      totalPoints: 15,
      questions: [],
      rows: [
        { row: rosterRow({ status: "graded", score: 12, scorePct: 80 }), cells: [] },
        { row: rosterRow({ status: "graded", score: 2, scorePct: (2 / 3) * 100 }), cells: [] },
      ],
    });
    const ws = (await readBack(buf)).getWorksheet("Tổng hợp")!;
    expect(ws.getRow(6).getCell(11).value).toBe(8);
    expect(ws.getRow(7).getCell(11).value).toBe(6.7);
  });
});

describe("answerCell", () => {
  it("chờ chấm thắng điểm tự chấm; đúng / sai / điểm lẻ / chưa có", () => {
    expect(answerCell(undefined, 2)).toBe("—");
    expect(answerCell({ autoScore: 1, manualScore: null, needsGrading: true }, 2)).toBe("Chờ chấm");
    expect(answerCell({ autoScore: 2, manualScore: null, needsGrading: false }, 2)).toBe("Đúng");
    expect(answerCell({ autoScore: 0, manualScore: null, needsGrading: false }, 2)).toBe("Sai");
    expect(answerCell({ autoScore: 0, manualScore: 1, needsGrading: false }, 2)).toBe("1/2");
  });
});
