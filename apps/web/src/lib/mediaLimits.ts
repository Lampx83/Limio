import { SUPPORTED_VIDEO_TYPES, VIDEO_MAX_BYTES, resolveVideoMime } from "./videoUpload";

/**
 * Giới hạn định dạng và dung lượng ảnh/audio/video tải lên đoạn văn, để nói rõ cho giảng viên TRƯỚC khi tải.
 * Ảnh và audio phản chiếu `IMAGE_*`/`AUDIO_*` của core-lms (máy khách không import được core); test `mediaLimits.test.ts` giữ hai bên khớp.
 */

export const IMAGE_LIMIT = {
  mimes: ["image/png", "image/jpeg", "image/webp", "image/gif"] as readonly string[],
  maxBytes: 5 * 1024 * 1024,
  label: "PNG, JPG, WebP, GIF",
};
export const AUDIO_LIMIT = {
  mimes: ["audio/mpeg", "audio/ogg", "audio/wav", "audio/webm", "audio/mp4"] as readonly string[],
  maxBytes: 25 * 1024 * 1024,
  label: "MP3, OGG, WAV, M4A, WebM",
};
export const VIDEO_LIMIT = {
  maxBytes: VIDEO_MAX_BYTES,
  label: "MP4, WebM, MOV, MKV, OGV",
};

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(1).replace(".0", "")} GB`;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1).replace(".0", "")} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`;

export const AUDIO_DIALOG_HINT = `Định dạng ${AUDIO_LIMIT.label}, tối đa ${mb(AUDIO_LIMIT.maxBytes)}.`;
export const VIDEO_DIALOG_HINT = `Định dạng ${VIDEO_LIMIT.label}, tối đa ${mb(VIDEO_LIMIT.maxBytes)}.`;

/** Lỗi (tiếng Việt) nếu ảnh không nhận được; null = hợp lệ. Kiểm sau khi đã thu nhỏ vì dung lượng tính trên tệp sẽ tải. */
export function checkImageFile(f: { type: string; size: number }): string | null {
  if (!IMAGE_LIMIT.mimes.includes(f.type)) return `Ảnh phải là ${IMAGE_LIMIT.label}.`;
  if (f.size > IMAGE_LIMIT.maxBytes) return `Ảnh nặng ${formatBytes(f.size)}, vượt mức tối đa ${mb(IMAGE_LIMIT.maxBytes)}. Hãy chọn ảnh nhỏ hơn.`;
  return null;
}

export function checkAudioFile(f: { type: string; size: number }): string | null {
  if (!AUDIO_LIMIT.mimes.includes(f.type)) return `Audio phải là ${AUDIO_LIMIT.label}.`;
  if (f.size > AUDIO_LIMIT.maxBytes) return `Audio nặng ${formatBytes(f.size)}, vượt mức tối đa ${mb(AUDIO_LIMIT.maxBytes)}.`;
  return null;
}

export function checkVideoFile(f: { type: string; size: number; name: string }): string | null {
  if (!resolveVideoMime(f.type, f.name)) return `Video phải là ${VIDEO_LIMIT.label}.`;
  if (f.size > VIDEO_LIMIT.maxBytes) return `Video nặng ${formatBytes(f.size)}, vượt mức tối đa ${mb(VIDEO_LIMIT.maxBytes)}. Hãy nén video hoặc dán link YouTube/Vimeo.`;
  return null;
}

// Giữ lại để nơi khác nhập từ một chỗ.
export { SUPPORTED_VIDEO_TYPES };
