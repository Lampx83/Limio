/**
 * LANG G7 — đọc file ghi âm của bài nộp từ kho của hệ thống. CHỈ nhận file do chính hệ thống lưu
 * (đường dẫn /api/assignment-media/<tên>): URL ngoài không bao giờ được máy chủ tải về (chống SSRF) và
 * không bao giờ được gửi tới nhà cung cấp AI.
 */
const MEDIA_RE = /\/api\/assignment-media\/([A-Za-z0-9._-]+)(?:\?.*)?$/;

export function parseAssignmentMediaFilename(url: string): string | null {
  const m = MEDIA_RE.exec(url.trim());
  if (!m) return null;
  const name = m[1]!;
  if (name.includes("..") || name.startsWith(".")) return null;
  return name;
}

const AUDIO_MIME: Record<string, string> = {
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
};

export function mimeForAudioFilename(name: string): string | null {
  const i = name.lastIndexOf(".");
  return i < 0 ? null : (AUDIO_MIME[name.slice(i).toLowerCase()] ?? null);
}
