import { describe, expect, it } from "vitest";
import { formatPct, resultVerdict } from "./examResultStatus";

describe("resultVerdict", () => {
  it("bài tự chấm xong vẫn là 'Đã chấm' dù status vẫn là submitted", () => {
    expect(
      resultVerdict({ status: "submitted", score: 3, needsGrading: false }).label,
    ).toBe("Đã chấm");
  });

  it("bài còn câu tự luận chờ chấm là 'Còn câu chờ chấm', không phải 'Đã chấm'", () => {
    expect(
      resultVerdict({ status: "submitted", score: 2, needsGrading: true }).label,
    ).toBe("Còn câu chờ chấm");
  });

  it("bài đã có status graded nhưng score null vẫn không được báo là đã chấm", () => {
    expect(
      resultVerdict({ status: "graded", score: null, needsGrading: false }).label,
    ).toBe("Đã nộp");
  });

  it("chưa làm và đang làm", () => {
    expect(
      resultVerdict({ status: "not_started", score: null, needsGrading: false }).label,
    ).toBe("Chưa làm");
    expect(
      resultVerdict({ status: "in_progress", score: null, needsGrading: false }).label,
    ).toBe("Đang làm");
  });
});

describe("formatPct", () => {
  it("một chữ số thập phân, khớp con số trung bình trên đầu trang", () => {
    expect(formatPct(19.44)).toBe("19.4%");
    expect(formatPct(50)).toBe("50.0%");
  });
});
