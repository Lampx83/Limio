/**
 * LANG G1 — luật nhận audio của bài học, dùng chung cho route upload, route phát
 * và form. Tách khỏi file route vì Next chỉ cho route export hàm HTTP.
 *
 * Quyết định (2026-10-03): bỏ wav — 10 phút wav stereo 44,1 kHz ≈ 106 MB, trong
 * khi 10 phút mp3/m4a 128 kbps chỉ ≈ 10 MB — và giới hạn 50 MB.
 */

export const AUDIO_MAX_BYTES = 50 * 1024 * 1024;

export const SUPPORTED_AUDIO_MIMES: ReadonlyArray<{
  mime: string;
  ext: string;
  label: string;
}> = [
  { mime: "audio/mpeg", ext: "mp3", label: "MP3" },
  { mime: "audio/mp4", ext: "m4a", label: "M4A (AAC)" },
  // Safari/iOS và một số phần mềm thu âm báo m4a là audio/x-m4a.
  { mime: "audio/x-m4a", ext: "m4a", label: "M4A (AAC)" },
  { mime: "audio/ogg", ext: "ogg", label: "Ogg (Vorbis/Opus)" },
  { mime: "audio/webm", ext: "webm", label: "WebM (Opus)" },
];

/** Cho thuộc tính `accept` của ô chọn file: khớp đúng danh sách ở trên. */
export const AUDIO_UPLOAD_ACCEPT =
  "audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/webm,.mp3,.m4a,.ogg,.webm";

const MIME_TO_EXT: Record<string, string> = Object.fromEntries(
  SUPPORTED_AUDIO_MIMES.map((m) => [m.mime, m.ext]),
);

// Một đuôi → một MIME khi phát lại (m4a phát bằng audio/mp4 cho mọi trình duyệt).
const EXT_TO_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  webm: "audio/webm",
};

/** MIME khi phát lại, theo đuôi file. null = không phải audio được hỗ trợ. */
export function audioMimeForFilename(filename: string): string | null {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return null;
  return EXT_TO_MIME[filename.slice(dot + 1).toLowerCase()] ?? null;
}

export type AudioUploadCheck =
  | { ok: true; ext: string }
  | {
      ok: false;
      status: 400 | 413 | 415;
      error: "validation_failed" | "file_too_large" | "unsupported_media_type";
      details?: unknown;
    };

/** Thứ tự kiểm: rỗng (400) → quá cỡ (413) → sai loại (415), giống route video. */
export function validateAudioUpload(file: { size: number; type: string }): AudioUploadCheck {
  if (file.size === 0) {
    return { ok: false, status: 400, error: "validation_failed", details: "empty_file" };
  }
  if (file.size > AUDIO_MAX_BYTES) {
    return { ok: false, status: 413, error: "file_too_large", details: { maxBytes: AUDIO_MAX_BYTES } };
  }
  const ext = MIME_TO_EXT[file.type];
  if (!ext) {
    return {
      ok: false,
      status: 415,
      error: "unsupported_media_type",
      details: { allowed: SUPPORTED_AUDIO_MIMES.map((m) => m.mime) },
    };
  }
  return { ok: true, ext };
}

/**
 * Gỡ lời thoại khỏi các khối audio có `showTranscript === false`.
 *
 * Phải chạy ở máy chủ, TRƯỚC khi payload đi vào props của component client:
 * LessonContent là client component nên props của nó được serialize xuống trình
 * duyệt (xem được ở tab Network / mã nguồn trang). Chỉ "không vẽ" lời thoại thì
 * học viên vẫn đọc được đáp án của bài nghe-hiểu trong dữ liệu trang.
 *
 * Trả mảng mới; không sửa đối tượng gốc. Khối loại khác được giữ nguyên tham chiếu.
 */
export function withoutHiddenAudioTranscripts<
  T extends { type: string; payload: unknown },
>(items: T[]): T[] {
  return items.map((item) => {
    if (item.type !== "audio") return item;
    const p = item.payload;
    if (!p || typeof p !== "object") return item;
    if ((p as { showTranscript?: unknown }).showTranscript !== false) return item;
    const { transcript: _omit, ...rest } = p as Record<string, unknown>;
    void _omit;
    return { ...item, payload: rest };
  });
}
