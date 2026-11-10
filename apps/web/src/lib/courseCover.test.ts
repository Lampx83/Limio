import { describe, expect, it } from "vitest";
import {
  COURSE_COVER_MAX_BYTES,
  courseCoverFilename,
  courseCoverUrlFromFilename,
  coverFilenameFromUrl,
  validateCoverFile,
} from "./courseCover";
import { courseCoverKey, courseCoverKeyFromFilename } from "./storage-keys";

// docs/tieu-chi/trang-khoa-hoc-banner-sach.md — AC3: JPG, PNG, WebP; tối đa 5 MB; báo lỗi bằng tiếng Việt.

describe("validateCoverFile", () => {
  it("nhận JPG, PNG, WebP trong giới hạn 5 MB", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(validateCoverFile({ type, size: 1024 })).toBeNull();
    }
    expect(validateCoverFile({ type: "image/png", size: COURSE_COVER_MAX_BYTES })).toBeNull();
  });

  it("từ chối tệp rỗng, quá cỡ và sai định dạng (GIF, SVG, PDF) bằng tiếng Việt", () => {
    expect(validateCoverFile({ type: "image/png", size: 0 })).toMatch(/rỗng/);
    expect(validateCoverFile({ type: "image/png", size: COURSE_COVER_MAX_BYTES + 1 })).toMatch(/5 MB/);
    for (const type of ["image/gif", "image/svg+xml", "application/pdf", ""]) {
      expect(validateCoverFile({ type, size: 100 }), type).toMatch(/JPG, PNG hoặc WebP/);
    }
  });
});

describe("tên tệp, đường dẫn và khoá lưu trữ", () => {
  it("tên tệp mang mã khoá và hậu tố ngẫu nhiên; đuôi theo loại ảnh; hai lần không trùng", () => {
    const a = courseCoverFilename("c-123", "image/jpeg");
    const b = courseCoverFilename("c-123", "image/jpeg");
    expect(a).toMatch(/^c-123-[0-9a-f]{12}\.jpg$/);
    expect(a).not.toBe(b);
    expect(courseCoverFilename("c-123", "image/png")).toMatch(/\.png$/);
    expect(courseCoverFilename("c-123", "image/webp")).toMatch(/\.webp$/);
  });

  it("URL ↔ tên tệp: chỉ nhận đường dẫn nội bộ đúng dạng, không nhận thoát thư mục", () => {
    const url = courseCoverUrlFromFilename("c-123-aabbccddeeff.jpg");
    expect(url).toBe("/api/course-covers/c-123-aabbccddeeff.jpg");
    expect(coverFilenameFromUrl(url)).toBe("c-123-aabbccddeeff.jpg");
    expect(coverFilenameFromUrl("/api/course-covers/c-123-aabbccddeeff.jpg?v=2")).toBe("c-123-aabbccddeeff.jpg");
    for (const bad of [null, undefined, "", "https://cdn.example.com/a.png", "/api/course-covers/../x.png", "/api/course-covers/a/b.png", "/api/org-logos/x.png"]) {
      expect(coverFilenameFromUrl(bad), String(bad)).toBeNull();
    }
  });

  it("khoá lưu trữ ở tầng public, gom theo khoá, suy ngược được từ tên tệp", () => {
    expect(courseCoverKey("c-123", "c-123-aabbccddeeff.jpg")).toEqual({ layer: "public", key: "course-covers/c-123/c-123-aabbccddeeff.jpg" });
    expect(courseCoverKeyFromFilename("c-123-aabbccddeeff.jpg")).toEqual(courseCoverKey("c-123", "c-123-aabbccddeeff.jpg"));
    expect(courseCoverKeyFromFilename("../etc/passwd")).toBeNull();
  });
});
