import { randomBytes } from "node:crypto";
import { COURSE_COVER_PATH_PREFIX } from "@feedbackme/shared-types";

/**
 * Ảnh bìa / banner khoá học (docs/tieu-chi/trang-khoa-hoc-banner-sach.md, AC3): JPG, PNG, WebP, tối đa 5 MB.
 * Hàm thuần dùng cho route tải lên và có test riêng; route chỉ ghép các hàm này với lưu trữ và quyền.
 */

export const COURSE_COVER_MAX_BYTES = 5 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Trả thông báo lỗi tiếng Việt, hoặc null nếu tệp dùng được. */
export function validateCoverFile(f: { type: string; size: number }): string | null {
  if (f.size === 0) return "Tệp ảnh rỗng.";
  if (f.size > COURSE_COVER_MAX_BYTES) return "Ảnh quá lớn, tối đa 5 MB.";
  if (!(f.type in MIME_TO_EXT)) return "Chỉ nhận ảnh JPG, PNG hoặc WebP.";
  return null;
}

/** `<courseId>-<12 hex ngẫu nhiên>.<đuôi>` — hậu tố ngẫu nhiên khiến đường dẫn là capability URL và đổi ảnh thì đổi URL (không dính cache). */
export function courseCoverFilename(courseId: string, mime: string): string {
  return `${courseId}-${randomBytes(6).toString("hex")}.${MIME_TO_EXT[mime] ?? "jpg"}`;
}

export function courseCoverUrlFromFilename(filename: string): string {
  return `${COURSE_COVER_PATH_PREFIX}${filename}`;
}

/** Tên tệp của một `coverUrl` nội bộ; null với URL ngoài, đường dẫn lạ hoặc có thoát thư mục. */
export function coverFilenameFromUrl(url: string | null | undefined): string | null {
  if (!url || !url.startsWith(COURSE_COVER_PATH_PREFIX)) return null;
  const name = url.slice(COURSE_COVER_PATH_PREFIX.length).split("?")[0] ?? "";
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name.includes("..")) return null;
  return name;
}
