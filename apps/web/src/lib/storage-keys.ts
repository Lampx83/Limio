/**
 * Storage key builders — single source of truth for upload paths.
 *
 * Layout (under each storage layer):
 *   public/                                          # CDN-cacheable, capability URL
 *     avatars/{userId}/{hex}.{ext}
 *     lesson-media/images/{yyyy}/{mm}/{filename}
 *     lesson-media/videos/{yyyy}/{mm}/{filename}
 *     lesson-media/pdfs/{yyyy}/{mm}/{filename}
 *     lesson-media/html/{yyyy}/{mm}/{filename}
 *     exam-assets/{yyyy}/{mm}/{filename}
 *     board-attachments/{yyyy}/{mm}/{filename}
 *   private/                                         # auth-gated
 *     submissions/{yyyy}/{mm}/{filename}
 *   tmp/{yyyy-mm-dd}/{session}/{filename}            # auto-purge >24h
 *
 * Filenames preserve the existing on-the-wire shape (e.g. `<userId>-<ms>-<hex>.<ext>`)
 * so URLs already stored in DB rows keep working — only the on-disk path changes,
 * and serving routes derive the sharded path from the filename.
 */

export type StorageLayer = "public" | "private" | "tmp";

export interface StorageKey {
  layer: StorageLayer;
  key: string;
}

function ym(date: Date): { yyyy: string; mm: string } {
  return {
    yyyy: String(date.getUTCFullYear()),
    mm: String(date.getUTCMonth() + 1).padStart(2, "0"),
  };
}

function ymd(date: Date): string {
  const { yyyy, mm } = ym(date);
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Avatar: per-user subdir keeps single-folder listing tidy & easy to nuke per-user. */
export function avatarKey(userId: string, filename: string): StorageKey {
  return { layer: "public", key: `avatars/${userId}/${filename}` };
}

/** Derive shard from an avatar filename that begins with `<userId>-`. */
export function avatarKeyFromFilename(filename: string): StorageKey | null {
  const m = /^([A-Za-z0-9_-]+)-[A-Za-z0-9]+\.[A-Za-z0-9]+$/.exec(filename);
  if (!m) return null;
  return avatarKey(m[1]!, filename);
}

type DateShardedKind =
  | "lesson-media/images"
  | "lesson-media/videos"
  | "lesson-media/pdfs"
  | "lesson-media/html"
  | "lesson-media/transcripts"
  | "exam-assets"
  | "submissions"
  | "proctor-snapshots"
  | "oral-exam-materials"
  | "whiteboard-pages"
  | "board-attachments";

function dateSharded(
  layer: StorageLayer,
  kind: DateShardedKind,
  date: Date,
  filename: string,
): StorageKey {
  const { yyyy, mm } = ym(date);
  return { layer, key: `${kind}/${yyyy}/${mm}/${filename}` };
}

export function lessonImageKey(date: Date, filename: string): StorageKey {
  return dateSharded("public", "lesson-media/images", date, filename);
}
export function lessonVideoKey(date: Date, filename: string): StorageKey {
  return dateSharded("public", "lesson-media/videos", date, filename);
}
export function lessonPdfKey(date: Date, filename: string): StorageKey {
  return dateSharded("public", "lesson-media/pdfs", date, filename);
}
export function lessonHtmlKey(date: Date, filename: string): StorageKey {
  return dateSharded("public", "lesson-media/html", date, filename);
}
/** A2.7 — Interactive transcript: GV upload file .vtt/.srt cho video YouTube. */
export function lessonTranscriptKey(date: Date, filename: string): StorageKey {
  return dateSharded("public", "lesson-media/transcripts", date, filename);
}
export function examAssetKey(date: Date, filename: string): StorageKey {
  return dateSharded("public", "exam-assets", date, filename);
}
/** B — Whiteboard annotate tài liệu: ảnh nền mỗi trang (public, guest xem không cần login). */
export function whiteboardPageKey(date: Date, filename: string): StorageKey {
  return dateSharded("public", "whiteboard-pages", date, filename);
}
/** Padlet-style board: file GV upload trực tiếp cho note đính kèm (ảnh/pdf, ≤5MB). */
export function boardAttachmentKey(date: Date, filename: string): StorageKey {
  return dateSharded("public", "board-attachments", date, filename);
}
export function submissionKey(date: Date, filename: string): StorageKey {
  return dateSharded("private", "submissions", date, filename);
}
/** A7.7.5 — Proctor snapshots: private, date-sharded under proctor-snapshots/. */
export function proctorSnapshotKey(date: Date, filename: string): StorageKey {
  return dateSharded("private", "proctor-snapshots", date, filename);
}
/**
 * A6.1 — Vấn đáp AI: tài liệu GV upload cho giảng viên ảo. `private` — KHÁC
 * examAssetKey (public) vì đây không phải nội dung hiển thị cho sinh viên,
 * chỉ AI đọc.
 */
export function oralExamMaterialKey(date: Date, filename: string): StorageKey {
  return dateSharded("private", "oral-exam-materials", date, filename);
}

/**
 * Recover the sharded key from a filename that embeds `<…>-<unixMs>-<hex>.<ext>`.
 * Used by serving routes which only receive the leaf filename in the URL.
 * Returns null if the filename doesn't carry a parseable timestamp.
 */
function dateShardedFromFilename(
  layer: StorageLayer,
  kind: DateShardedKind,
  filename: string,
): StorageKey | null {
  const m = /-(\d{10,})-[A-Za-z0-9]+\.[A-Za-z0-9]+$/.exec(filename);
  if (!m) return null;
  const ms = Number(m[1]);
  if (!Number.isFinite(ms)) return null;
  return dateSharded(layer, kind, new Date(ms), filename);
}

export function lessonImageKeyFromFilename(filename: string): StorageKey | null {
  return dateShardedFromFilename("public", "lesson-media/images", filename);
}
export function lessonVideoKeyFromFilename(filename: string): StorageKey | null {
  return dateShardedFromFilename("public", "lesson-media/videos", filename);
}
export function lessonPdfKeyFromFilename(filename: string): StorageKey | null {
  return dateShardedFromFilename("public", "lesson-media/pdfs", filename);
}
export function lessonHtmlKeyFromFilename(filename: string): StorageKey | null {
  return dateShardedFromFilename("public", "lesson-media/html", filename);
}
export function lessonTranscriptKeyFromFilename(filename: string): StorageKey | null {
  return dateShardedFromFilename("public", "lesson-media/transcripts", filename);
}
export function examAssetKeyFromFilename(filename: string): StorageKey | null {
  return dateShardedFromFilename("public", "exam-assets", filename);
}
export function whiteboardPageKeyFromFilename(filename: string): StorageKey | null {
  return dateShardedFromFilename("public", "whiteboard-pages", filename);
}
export function boardAttachmentKeyFromFilename(filename: string): StorageKey | null {
  return dateShardedFromFilename("public", "board-attachments", filename);
}
export function submissionKeyFromFilename(filename: string): StorageKey | null {
  return dateShardedFromFilename("private", "submissions", filename);
}
export function proctorSnapshotKeyFromFilename(filename: string): StorageKey | null {
  return dateShardedFromFilename("private", "proctor-snapshots", filename);
}
export function oralExamMaterialKeyFromFilename(filename: string): StorageKey | null {
  return dateShardedFromFilename("private", "oral-exam-materials", filename);
}

/** Tmp staging for rich-text paste / multipart-upload flows. */
export function tmpKey(
  session: string,
  filename: string,
  now: Date = new Date(),
): StorageKey {
  return { layer: "tmp", key: `${ymd(now)}/${session}/${filename}` };
}

