// Pastel palette — phải match server's COLORS trong public/boards/[code]/notes.
export const BOARD_NOTE_COLORS = [
  "#FEF3C7", // amber
  "#DBEAFE", // blue
  "#D1FAE5", // green
  "#FCE7F3", // pink
  "#E9D5FF", // purple
  "#FED7AA", // orange
] as const;

// Random rotation -2deg..+2deg dựa trên hash id — deterministic để cùng note luôn
// quay cùng góc trên mọi client. Tạo cảm giác "giấy dán thật" như Padlet.
export function rotationForNote(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const deg = ((Math.abs(hash) % 41) - 20) / 10;
  return `${deg.toFixed(1)}deg`;
}

// ──────────────────────────────────────────────────────────────────────────
// Media URL detection
// ──────────────────────────────────────────────────────────────────────────

export type MediaKind = "image" | "video" | "audio" | "youtube" | "vimeo" | "link";

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac|flac)(\?|#|$)/i;

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
const VIMEO_RE = /vimeo\.com\/(\d+)/;

// Hosts trả ảnh raw không cần đuôi file (Unsplash, Imgur, Cloudinary, etc.)
const IMAGE_HOSTS = new Set([
  "images.unsplash.com",
  "i.imgur.com",
  "imgur.com",
  "res.cloudinary.com",
  "i.redd.it",
  "preview.redd.it",
  "pbs.twimg.com",
  "media.giphy.com",
  "live.staticflickr.com",
]);

export function detectMediaKind(url: string): MediaKind {
  if (YOUTUBE_RE.test(url)) return "youtube";
  if (VIMEO_RE.test(url)) return "vimeo";
  if (IMAGE_EXT.test(url)) return "image";
  if (VIDEO_EXT.test(url)) return "video";
  if (AUDIO_EXT.test(url)) return "audio";
  // Hostname-based fallback cho image
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (IMAGE_HOSTS.has(host)) return "image";
  } catch {
    /* fallthrough */
  }
  return "link";
}

export function extractYouTubeId(url: string): string | null {
  const m = url.match(YOUTUBE_RE);
  return m?.[1] ?? null;
}

export function extractVimeoId(url: string): string | null {
  const m = url.match(VIMEO_RE);
  return m?.[1] ?? null;
}

// Validate URL: chỉ chấp nhận http/https, max 2000 ký tự.
export function isValidAttachmentUrl(url: string): boolean {
  if (url.length > 2000) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Grid theo nhóm (columns) — dùng chung giữa host view (InteractiveBoard.tsx)
// và student view (/join/[code]).
// ──────────────────────────────────────────────────────────────────────────

// Nhãn bucket cho note post trước khi board bật grid, hoặc note thuộc cột đã bị GV xoá
// (note vẫn giữ nguyên `column` gốc — xem schema BoardNote.column — chỉ không còn khớp
// danh sách cột đang active nên rơi vào đây thay vì bị mất).
export const UNASSIGNED_COLUMN_LABEL = "Chưa phân nhóm";

export interface BoardColumnGroup<T> {
  label: string;
  notes: T[];
}

// Gom note theo cột, giữ đúng thứ tự cột GV đã đặt; note không có cột (hoặc cột không
// còn active) rơi vào bucket cuối `UNASSIGNED_COLUMN_LABEL`.
export function groupNotesByColumn<T extends { column?: string | null }>(
  notes: T[],
  columns: string[],
): BoardColumnGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const label of columns) buckets.set(label, []);
  const leftover: T[] = [];
  for (const note of notes) {
    if (!note.column) {
      leftover.push(note);
      continue;
    }
    if (!buckets.has(note.column)) buckets.set(note.column, []);
    buckets.get(note.column)!.push(note);
  }
  const result: BoardColumnGroup<T>[] = [...buckets.entries()].map(([label, groupNotes]) => ({
    label,
    notes: groupNotes,
  }));
  if (leftover.length > 0) result.push({ label: UNASSIGNED_COLUMN_LABEL, notes: leftover });
  return result;
}
