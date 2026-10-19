import { describe, expect, it } from "vitest";
import { buildBulkBody, describeBulkError, describeImportRow, parseManifestText, summarizeBulk } from "@/lib/libraryTable";

/** LANG L6.6 / L6.8 — phần thuần của bảng quản lý đề và nhập hàng loạt (giao diện giảng viên). */

describe("buildBulkBody — chuyển thao tác trên thanh công cụ thành yêu cầu API", () => {
  const ids = ["a", "b"];
  it("gán loại / độ khó / nguồn / năm / bộ", () => {
    expect(buildBulkBody("paperType", "official", ids)).toEqual({ action: "update", examIds: ids, patch: { paperType: "official" } });
    expect(buildBulkBody("difficulty", "4", ids)).toEqual({ action: "update", examIds: ids, patch: { difficulty: 4 } });
    expect(buildBulkBody("sourceLabel", " HSK 2023 ", ids)).toEqual({ action: "update", examIds: ids, patch: { sourceLabel: "HSK 2023" } });
    expect(buildBulkBody("collection", "c1", ids)).toEqual({ action: "update", examIds: ids, patch: { collectionId: "c1" } });
  });
  it("giá trị rỗng = xoá phân loại (null)", () => {
    expect(buildBulkBody("paperType", "", ids).patch).toEqual({ paperType: null });
    expect(buildBulkBody("difficulty", "", ids).patch).toEqual({ difficulty: null });
    expect(buildBulkBody("collection", "", ids).patch).toEqual({ collectionId: null });
  });
  it("tag: thêm / bỏ theo danh sách phân cách bằng dấu phẩy, bỏ trống và trùng", () => {
    expect(buildBulkBody("tagsAdd", "a, b ,, a", ids)).toEqual({ action: "update", examIds: ids, patch: { tags: ["a", "b"] }, tagsMode: "add" });
    expect(buildBulkBody("tagsRemove", "x", ids)).toEqual({ action: "update", examIds: ids, patch: { tags: ["x"] }, tagsMode: "remove" });
  });
  it("bật/tắt chế độ và học thử", () => {
    expect(buildBulkBody("allowMock", "on", ids).patch).toEqual({ allowMock: true });
    expect(buildBulkBody("allowPractice", "off", ids).patch).toEqual({ allowPractice: false });
    expect(buildBulkBody("freePreview", "on", ids).patch).toEqual({ freePreview: true });
  });
  it("xuất bản, lưu trữ, nhân bản không có patch", () => {
    expect(buildBulkBody("publish", "", ids)).toEqual({ action: "publish", examIds: ids });
    expect(buildBulkBody("archive", "", ids)).toEqual({ action: "archive", examIds: ids });
    expect(buildBulkBody("clone", "", ids)).toEqual({ action: "clone", examIds: ids });
  });
});

describe("summarizeBulk / describeBulkError", () => {
  it("đếm thành công và lỗi, liệt kê dòng lỗi kèm lý do tiếng Việt", () => {
    const s = summarizeBulk(
      [
        { examId: "a", ok: true },
        { examId: "b", ok: false, error: "exam_has_attempts" },
        { examId: "c", ok: false, error: "exam_not_in_course" },
        { examId: "d", ok: false, error: "weird" },
      ],
      new Map([["b", "Đề B"], ["c", "Đề C"]]),
    );
    expect(s.ok).toBe(1);
    expect(s.failed).toBe(3);
    expect(s.message).toBe("1 đề thành công, 3 đề không làm được.");
    expect(s.failures.map((f) => f.title)).toEqual(["Đề B", "Đề C", "d"]);
    expect(s.failures[0]!.reason).toMatch(/đã có người thi/);
  });
  it("mọi mã lỗi quen thuộc có lời nhắn riêng, mã lạ có lời nhắn chung", () => {
    const generic = describeBulkError("zzz");
    for (const c of ["exam_has_attempts", "exam_not_found", "exam_not_in_course", "exam_not_draft", "validation_failed", "section_missing_duration"]) {
      expect(describeBulkError(c), c).not.toBe(generic);
    }
  });
});

describe("parseManifestText (nhập hàng loạt)", () => {
  it("nhận JSON hợp lệ có mảng exams; từ chối chuỗi rỗng, JSON hỏng, sai hình dạng", () => {
    expect(parseManifestText('{"exams":[{"title":"x"}]}')).toEqual({ ok: true, manifest: { exams: [{ title: "x" }] }, count: 1 });
    expect(parseManifestText("")).toMatchObject({ ok: false });
    expect(parseManifestText("{nope")).toMatchObject({ ok: false, error: expect.stringMatching(/JSON/) });
    expect(parseManifestText('{"foo":1}')).toMatchObject({ ok: false, error: expect.stringMatching(/exams/) });
    expect(parseManifestText('{"exams":[]}')).toMatchObject({ ok: false });
  });
  it("giới hạn 500 đề", () => {
    const many = JSON.stringify({ exams: Array.from({ length: 501 }, () => ({ title: "x" })) });
    expect(parseManifestText(many)).toMatchObject({ ok: false, error: expect.stringMatching(/500/) });
  });
});

describe("describeImportRow", () => {
  it("nhãn trạng thái từng đề", () => {
    expect(describeImportRow("created")).toBe("Đã tạo");
    expect(describeImportRow("would_create")).toBe("Sẽ tạo");
    expect(describeImportRow("skipped_duplicate")).toBe("Bỏ qua (đã có)");
    expect(describeImportRow("error")).toBe("Lỗi");
  });
});
