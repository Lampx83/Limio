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

// Upload file trực tiếp cho đính kèm — chỉ GV (xem route
// /api/instructor/teaching-tools/boards/[id]/attachments). Học viên vẫn chỉ dán URL.
export const BOARD_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB — khớp quy ước avatar/exam-import
export const BOARD_ATTACHMENT_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};
export const BOARD_ATTACHMENT_ACCEPT = Object.keys(BOARD_ATTACHMENT_MIME_TO_EXT).join(",");

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

// Ảnh do chính hệ thống lưu (hình vẽ Draw-it của học viên, ảnh GV upload) — đường dẫn tương đối,
// không qua được isValidAttachmentUrl (chỉ nhận http/https tuyệt đối). Server chỉ chấp nhận đúng
// dạng file ảnh trong thư mục board-attachments, không nhận đường dẫn tự do.
const BOARD_ATTACHMENT_PATH_RE = /^\/api\/board-attachments\/[A-Za-z0-9._-]+\.(png|jpe?g|webp|gif)$/;
export function isBoardAttachmentPath(url: string): boolean {
  return BOARD_ATTACHMENT_PATH_RE.test(url);
}
export function isAcceptableAttachmentUrl(url: string): boolean {
  return isValidAttachmentUrl(url) || isBoardAttachmentPath(url);
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

// Header cột — đậm hơn 1 bậc so với BOARD_NOTE_COLORS (pastel -100) để tạo phân tầng:
// thanh header nổi bật, note bên trong vẫn nhẹ nhàng như cũ.
const BOARD_COLUMN_HEADER_COLORS = [
  "#FDE68A", // amber-300
  "#93C5FD", // blue-300
  "#6EE7B7", // green-300
  "#F9A8D4", // pink-300
  "#C4B5FD", // purple-300
  "#FDBA74", // orange-300
] as const;

// index = vị trí cột trong board.columns hiện tại; -1 (cột hệ thống — chưa phân nhóm /
// đã bị GV xoá) → xám trung tính, không lẫn với màu GV đang dùng cho nhóm thật.
export function columnHeaderColor(index: number): string {
  if (index < 0) return "#E5E7EB"; // gray-200
  return BOARD_COLUMN_HEADER_COLORS[index % BOARD_COLUMN_HEADER_COLORS.length]!;
}
