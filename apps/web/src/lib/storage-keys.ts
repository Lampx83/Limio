/**
 * Storage key builders — single source of truth for upload paths.
 *
 * Layout (under each storage layer):
 *   public/                                          # CDN-cacheable, capability URL
 *     avatars/{userId}/{hex}.{ext}
 *     lesson-media/images/{yyyy}/{mm}/{filename}
 *     lesson-media/videos/{yyyy}/{mm}/{filename}
 *     lesson-media/pdfs/{yyyy}/{mm}/{filename}
 *     exam-assets/{yyyy}/{mm}/{filename}
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
  | "exam-assets"
  | "submissions";

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
export function examAssetKey(date: Date, filename: string): StorageKey {
  return dateSharded("public", "exam-assets", date, filename);
}
export function submissionKey(date: Date, filename: string): StorageKey {
  return dateSharded("private", "submissions", date, filename);
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
export function examAssetKeyFromFilename(filename: string): StorageKey | null {
  return dateShardedFromFilename("public", "exam-assets", filename);
}
export function submissionKeyFromFilename(filename: string): StorageKey | null {
  return dateShardedFromFilename("private", "submissions", filename);
}

/** Tmp staging for rich-text paste / multipart-upload flows. */
export function tmpKey(
  session: string,
  filename: string,
  now: Date = new Date(),
): StorageKey {
  return { layer: "tmp", key: `${ymd(now)}/${session}/${filename}` };
}

