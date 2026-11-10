/** Tên tệp trong đường dẫn `/api/exam-assets/<tên>` (có hoặc không có tiền tố basePath). Cùng quy tắc với `examAssetFilename` ở core-lms (máy khách không import được core). */
export function examAssetFilenameFromUrl(src: unknown): string | null {
  if (typeof src !== "string") return null;
  const m = /\/api\/exam-assets\/([A-Za-z0-9._-]+)(?:[?#].*)?$/.exec(src);
  return m ? m[1]! : null;
}

/**
 * Khoá transcript của một video trong đoạn văn: video tải lên → tên tệp; video dán link → `link:<đường dẫn>`.
 * Cùng quy tắc với `videoAssetKey` ở core-lms.
 */
export function videoTranscriptKey(src: unknown): string | null {
  if (typeof src !== "string" || src.trim() === "") return null;
  const m = /\/api\/lesson-media\/videos\/([A-Za-z0-9._-]+)(?:[?#].*)?$/.exec(src);
  return m ? m[1]! : `link:${src.trim()}`;
}
