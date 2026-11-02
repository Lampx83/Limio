import { describe, expect, it } from "vitest";
import {
  buildOralExamBatchName,
  buildOralExamFilename,
  createUniqueFilenames,
} from "./oralExamFilename";

const date = new Date("2026-11-02T03:00:00Z");

describe("buildOralExamFilename", () => {
  it("theo mẫu tên học viên, ngày thi, tên đề và giữ dấu tiếng Việt", () => {
    expect(buildOralExamFilename("Nguyễn Văn An", date, "Giữa kỳ Kinh tế vi mô")).toBe(
      "Nguyễn Văn An - 02-11-2026 - Giữa kỳ Kinh tế vi mô.docx",
    );
  });

  it("lấy ngày theo giờ Việt Nam, không theo giờ quốc tế", () => {
    // 23:30 ngày 02/11 giờ quốc tế là 06:30 sáng 03/11 ở Việt Nam.
    const earlyMorning = new Date("2026-11-02T23:30:00Z");
    expect(buildOralExamFilename("An", earlyMorning, "Đề")).toBe("An - 03-11-2026 - Đề.docx");
  });

  it("bỏ ký tự hệ điều hành cấm, kể cả dấu gạch chéo có thể tạo thư mục giả trong file nén", () => {
    expect(buildOralExamFilename("An/../Bình", date, 'Đề: "Cuối/kỳ"?')).toBe(
      "An .. Bình - 02-11-2026 - Đề Cuối kỳ.docx",
    );
  });

  it("có tên thay thế khi tên trống và cắt tên quá dài", () => {
    expect(buildOralExamFilename("  ", date, "")).toBe(
      "Học viên - 02-11-2026 - Đề vấn đáp.docx",
    );
    const long = buildOralExamFilename("An", date, "Đ".repeat(300));
    expect(long).toBe(`An - 02-11-2026 - ${"Đ".repeat(80)}.docx`);
  });

  it("gộp về một dạng chữ để cùng một tên không thành hai file", () => {
    const decomposed = "Nguyễn".normalize("NFD");
    expect(buildOralExamFilename(decomposed, date, "Đề")).toBe(
      "Nguyễn".normalize("NFC") + " - 02-11-2026 - Đề.docx",
    );
  });
});

describe("buildOralExamBatchName", () => {
  it("gồm tên đề và ngày xuất", () => {
    expect(buildOralExamBatchName("Giữa kỳ / Lớp A", date)).toBe(
      "Vấn đáp - Giữa kỳ Lớp A - 02-11-2026",
    );
  });
});

describe("createUniqueFilenames", () => {
  it("thêm số thứ tự khi trùng, không phân biệt hoa thường", () => {
    const unique = createUniqueFilenames();
    expect(unique("An - Đề.docx")).toBe("An - Đề.docx");
    expect(unique("An - Đề.docx")).toBe("An - Đề (2).docx");
    expect(unique("AN - ĐỀ.docx")).toBe("AN - ĐỀ (3).docx");
    expect(unique("Bình - Đề.docx")).toBe("Bình - Đề.docx");
  });
});
