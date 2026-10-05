import { describe, expect, it } from "vitest";
import {
  LESSON_FILE_EXTENSIONS,
  LESSON_FILE_MAX_BYTES,
  LESSON_FILE_UPLOAD_ACCEPT,
  lessonFileMimeForFilename,
  validateLessonFileUpload,
} from "@/lib/lessonFile";

/**
 * Tài nguyên "File đính kèm" — luật nhận file. Giới hạn 10 MB (chốt với chủ
 * dự án 2026-10-04). Kiểm theo đuôi, không theo MIME trình duyệt báo.
 */

describe("validateLessonFileUpload", () => {
  it.each(["handout.pdf", "Bài 1.DOCX", "slide.pptx", "bang-diem.xlsx", "data.csv", "code.zip", "anh.JPG", "nghe.mp3"])(
    "nhận %s",
    (name) => {
      expect(validateLessonFileUpload({ size: 1024, name })).toMatchObject({ ok: true });
    },
  );

  it("đuôi luôn được chuẩn hoá về chữ thường", () => {
    expect(validateLessonFileUpload({ size: 1, name: "A.DOCX" })).toEqual({ ok: true, ext: "docx" });
  });

  it("đúng 10 MB thì nhận, hơn 1 byte thì 413", () => {
    expect(LESSON_FILE_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(validateLessonFileUpload({ size: LESSON_FILE_MAX_BYTES, name: "a.pdf" })).toMatchObject({ ok: true });
    expect(validateLessonFileUpload({ size: LESSON_FILE_MAX_BYTES + 1, name: "a.pdf" })).toMatchObject({
      ok: false,
      status: 413,
      error: "file_too_large",
    });
  });

  it("file chạy được script trên origin hoặc file thực thi → 415", () => {
    for (const name of ["x.html", "x.htm", "x.svg", "x.js", "x.xml", "x.exe", "x.sh", "x.pdf.html", "khong-duoi", "dau-cham."]) {
      expect(validateLessonFileUpload({ size: 1024, name })).toMatchObject({
        ok: false,
        status: 415,
        error: "unsupported_media_type",
      });
    }
  });

  it("file rỗng → 400, kiểm trước loại file", () => {
    expect(validateLessonFileUpload({ size: 0, name: "x.exe" })).toMatchObject({ ok: false, status: 400 });
  });
});

describe("danh sách đuôi", () => {
  it("không có loại nguy hiểm khi mở trên origin", () => {
    for (const bad of ["html", "htm", "svg", "js", "xml", "xhtml", "exe"]) {
      expect(LESSON_FILE_EXTENSIONS).not.toContain(bad);
    }
  });

  it("chuỗi accept khớp danh sách đuôi", () => {
    for (const ext of LESSON_FILE_EXTENSIONS) expect(LESSON_FILE_UPLOAD_ACCEPT).toContain(`.${ext}`);
  });

  it("content-type khi tải về theo đuôi; đuôi lạ → null", () => {
    expect(lessonFileMimeForFilename("u-1790000000000-ab.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(lessonFileMimeForFilename("u-1790000000000-ab.zip")).toBe("application/zip");
    expect(lessonFileMimeForFilename("u-1790000000000-ab.html")).toBeNull();
    expect(lessonFileMimeForFilename("khong-duoi")).toBeNull();
  });
});
