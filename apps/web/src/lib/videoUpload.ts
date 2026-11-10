/**
 * Tải video lên kho bài học (`/api/lesson-media/videos`): loại tệp được nhận và thông báo lỗi tiếng Việt.
 * Dùng chung cho route (nhận/từ chối) và trình soạn (hiện lỗi cho giảng viên).
 */

export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;

export const SUPPORTED_VIDEO_TYPES: ReadonlyArray<{ mime: string; ext: string; label: string }> = [
  { mime: "video/mp4", ext: "mp4", label: "MP4 (H.264 / H.265)" },
  { mime: "video/webm", ext: "webm", label: "WebM (VP8/VP9)" },
  { mime: "video/ogg", ext: "ogv", label: "Ogg Theora" },
  { mime: "video/quicktime", ext: "mov", label: "MOV (QuickTime)" },
  { mime: "video/x-matroska", ext: "mkv", label: "MKV" },
];

const EXT_TO_MIME = new Map<string, string>([
  ...SUPPORTED_VIDEO_TYPES.map((t) => [t.ext, t.mime] as const),
  ["m4v", "video/mp4"],
]);

/**
 * Loại video của tệp tải lên, hoặc null nếu không nhận. Trình duyệt hay báo loại rỗng hoặc `application/octet-stream` cho .mkv/.mov
 * (Safari, Windows chưa cài bộ giải mã), nên khi loại không dùng được thì dựa vào đuôi tệp thay vì từ chối.
 */
export function resolveVideoMime(type: string, filename: string): string | null {
  const t = type.trim().toLowerCase();
  if (SUPPORTED_VIDEO_TYPES.some((s) => s.mime === t)) return t;
  if (t === "video/x-m4v") return "video/mp4";
  if (t === "" || t === "application/octet-stream" || t === "video/x-matroska-3d" || t === "video/matroska") {
    const ext = /\.([A-Za-z0-9]+)$/.exec(filename)?.[1]?.toLowerCase();
    return (ext && EXT_TO_MIME.get(ext)) || null;
  }
  return null;
}

/** Thông báo cho giảng viên khi tải video lỗi (mã lỗi của route → câu tiếng Việt). */
export function videoUploadErrorMessage(error: string | undefined, status: number): string {
  if (error === "file_too_large" || status === 413) return `Video quá lớn (tối đa ${VIDEO_MAX_BYTES / 1024 / 1024} MB). Hãy nén video hoặc dán link YouTube/Vimeo.`;
  if (error === "unsupported_media_type" || status === 415) return "Định dạng video chưa hỗ trợ. Dùng MP4, WebM, MOV, MKV hoặc OGV.";
  if (error === "unauthorized" || status === 401) return "Phiên đăng nhập đã hết. Hãy tải lại trang và đăng nhập lại.";
  if (error === "empty_file" || error === "validation_failed") return "Tệp video rỗng hoặc không đọc được.";
  return `Tải video lỗi (${error ?? status}). Thử lại, hoặc dán link video.`;
}
