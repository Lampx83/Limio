/**
 * Tài nguyên "File đính kèm" của bài học — luật nhận file dùng chung cho route
 * upload, route tải về và form. Tách khỏi file route vì Next chỉ cho route
 * export hàm HTTP.
 *
 * Kiểm theo ĐUÔI file chứ không theo MIME: trình duyệt báo MIME rất thất thường
 * cho đúng những loại GV hay đính kèm (.docx trên Windows thiếu Office ra
 * `application/octet-stream`, .zip ra `application/x-zip-compressed`, .csv ra
 * `application/vnd.ms-excel`…). An toàn không dựa vào MIME client gửi: route tải
 * về tự đặt content-type theo đuôi + ép `attachment` + `nosniff`, nên file không
 * bao giờ được trình duyệt chạy như trang trên origin của mình.
 *
 * Cố ý KHÔNG nhận html/htm/svg/js/xml (chạy được script khi mở trên origin) và
 * file thực thi. HTML có tile riêng (html_block) với CSP sandbox.
 */

export const LESSON_FILE_MAX_BYTES = 10 * 1024 * 1024;

const EXT_TO_MIME: Record<string, string> = {
  // Tài liệu
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  odt: "application/vnd.oasis.opendocument.text",
  odp: "application/vnd.oasis.opendocument.presentation",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  rtf: "application/rtf",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  // Nén
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  // Ảnh
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  // Âm thanh
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
};

export const LESSON_FILE_EXTENSIONS: ReadonlyArray<string> = Object.keys(EXT_TO_MIME);

/** Cho thuộc tính `accept` của ô chọn file. */
export const LESSON_FILE_UPLOAD_ACCEPT = LESSON_FILE_EXTENSIONS.map((e) => `.${e}`).join(",");

function extOf(filename: string): string | null {
  const dot = filename.lastIndexOf(".");
  if (dot < 0 || dot === filename.length - 1) return null;
  return filename.slice(dot + 1).toLowerCase();
}

/** content-type khi tải về, theo đuôi. null = đuôi không được nhận. */
export function lessonFileMimeForFilename(filename: string): string | null {
  const ext = extOf(filename);
  return ext ? (EXT_TO_MIME[ext] ?? null) : null;
}

export type LessonFileUploadCheck =
  | { ok: true; ext: string }
  | {
      ok: false;
      status: 400 | 413 | 415;
      error: "validation_failed" | "file_too_large" | "unsupported_media_type";
      details?: unknown;
    };

/** Thứ tự kiểm: rỗng (400) → quá cỡ (413) → sai loại (415), giống route audio. */
export function validateLessonFileUpload(file: { size: number; name: string }): LessonFileUploadCheck {
  if (file.size === 0) {
    return { ok: false, status: 400, error: "validation_failed", details: "empty_file" };
  }
  if (file.size > LESSON_FILE_MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      error: "file_too_large",
      details: { maxBytes: LESSON_FILE_MAX_BYTES },
    };
  }
  const ext = extOf(file.name);
  if (!ext || !EXT_TO_MIME[ext]) {
    return {
      ok: false,
      status: 415,
      error: "unsupported_media_type",
      details: { allowed: LESSON_FILE_EXTENSIONS },
    };
  }
  return { ok: true, ext };
}

