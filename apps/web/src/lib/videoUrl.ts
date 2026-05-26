/**
 * Shared video URL parser.
 *
 * Detects URL patterns from common providers and returns embed metadata.
 * Used by LessonContent (player), AddContentItemForm (paste-time validation),
 * and ContentItemRow (thumbnail preview in editor).
 */

export type VideoKind =
  | "youtube"
  | "vimeo"
  | "loom"
  | "wistia"
  | "bunny"
  | "mux"
  | "file";

export interface ParsedVideo {
  kind: VideoKind;
  /** Provider-assigned id (videoId, mediaHash, playbackId, ...). */
  id: string;
  /** URL to render in an <iframe src=...>. For 'file' this is the original URL for <video src=...>. */
  embedUrl: string;
  /** Thumbnail URL if cheaply derivable client-side. Undefined if needs an API call. */
  thumbnailUrl?: string;
  /** Display name of provider, e.g. "YouTube". */
  providerName: string;
  /** Optional start offset in seconds, parsed from ?t=... params. */
  start?: number;
  /** Bunny only: library id (needed in addition to videoId for embed URL). */
  libraryId?: string;
}

const PROVIDER_LABELS: Record<VideoKind, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  loom: "Loom",
  wistia: "Wistia",
  bunny: "Bunny Stream",
  mux: "Mux",
  file: "Video file",
};

/** Parse "90", "1m30s", "1h2m3s" → seconds. Returns undefined if unparseable. */
function parseTimeToSeconds(t: string): number | undefined {
  if (/^\d+$/.test(t)) return Number(t);
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m) return undefined;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  const total = h * 3600 + min * 60 + s;
  return total > 0 ? total : undefined;
}

const FILE_EXT = /\.(mp4|m4v|mov|webm|ogg|ogv|m3u8|mpd)(\?|#|$)/i;

export function parseVideoUrl(rawUrl: string): ParsedVideo | null {
  const url = rawUrl.trim();
  if (!url) return null;

  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  const host = u.hostname.replace(/^www\./, "");

  // ---------- YouTube ----------
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    if (id) {
      const t = u.searchParams.get("t");
      return makeYoutube(id, t);
    }
  }
  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    const v = u.searchParams.get("v");
    if (v) {
      const t = u.searchParams.get("t") ?? u.searchParams.get("start");
      return makeYoutube(v, t);
    }
    const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})/);
    if (m) return makeYoutube(m[1]!);
  }

  // ---------- Vimeo ----------
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/\/(?:video\/)?(\d+)(?:\/|$)/);
    if (m) {
      const id = m[1]!;
      return {
        kind: "vimeo",
        id,
        embedUrl: `https://player.vimeo.com/video/${id}`,
        // Vimeo thumbnail needs oembed API call — skip client-side.
        providerName: PROVIDER_LABELS.vimeo,
      };
    }
  }

  // ---------- Loom ----------
  if (host === "loom.com" || host.endsWith(".loom.com")) {
    const m = u.pathname.match(/\/(?:share|embed)\/([a-z0-9]{16,})/i);
    if (m) {
      const id = m[1]!;
      return {
        kind: "loom",
        id,
        embedUrl: `https://www.loom.com/embed/${id}`,
        providerName: PROVIDER_LABELS.loom,
      };
    }
  }

  // ---------- Wistia ----------
  // Public:  wistia.com/medias/<hash>
  // Embed:   <sub>.wistia.com/medias/<hash>
  // Iframe:  fast.wistia.net/embed/iframe/<hash>
  if (host.endsWith("wistia.com") || host.endsWith("wistia.net")) {
    const m = u.pathname.match(/\/(?:medias|embed\/iframe)\/([a-z0-9]{8,})/i);
    if (m) {
      const id = m[1]!;
      return {
        kind: "wistia",
        id,
        embedUrl: `https://fast.wistia.net/embed/iframe/${id}`,
        thumbnailUrl: `https://embed-ssl.wistia.com/deliveries/${id}.jpg`,
        providerName: PROVIDER_LABELS.wistia,
      };
    }
  }

  // ---------- Bunny Stream ----------
  // Iframe URL: iframe.mediadelivery.net/embed/<libraryId>/<videoId>
  // Play URL:   iframe.mediadelivery.net/play/<libraryId>/<videoId>
  if (host === "iframe.mediadelivery.net") {
    const m = u.pathname.match(/\/(?:embed|play)\/(\d+)\/([\w-]+)/);
    if (m) {
      const libraryId = m[1]!;
      const videoId = m[2]!;
      return {
        kind: "bunny",
        id: videoId,
        libraryId,
        embedUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`,
        // Bunny thumbnail format: vz-<libraryId>.b-cdn.net/<videoId>/thumbnail.jpg —
        // not always reachable from any account; skip auto-thumbnail.
        providerName: PROVIDER_LABELS.bunny,
      };
    }
  }

  // ---------- Mux ----------
  // Player iframe: player.mux.com/<playbackId>
  // HLS:           stream.mux.com/<playbackId>.m3u8 (raw, treated as file w/ player support)
  if (host === "player.mux.com") {
    const m = u.pathname.match(/^\/([\w-]+)/);
    if (m) {
      const id = m[1]!;
      return {
        kind: "mux",
        id,
        embedUrl: `https://player.mux.com/${id}`,
        thumbnailUrl: `https://image.mux.com/${id}/thumbnail.jpg?width=320&time=1`,
        providerName: PROVIDER_LABELS.mux,
      };
    }
  }
  if (host === "stream.mux.com") {
    const m = u.pathname.match(/^\/([\w-]+)\.m3u8/);
    if (m) {
      const id = m[1]!;
      return {
        kind: "mux",
        id,
        embedUrl: `https://player.mux.com/${id}`,
        thumbnailUrl: `https://image.mux.com/${id}/thumbnail.jpg?width=320&time=1`,
        providerName: PROVIDER_LABELS.mux,
      };
    }
  }

  // ---------- Direct file ----------
  if (FILE_EXT.test(url)) {
    return {
      kind: "file",
      id: url,
      embedUrl: url,
      providerName: PROVIDER_LABELS.file,
    };
  }

  return null;
}

function makeYoutube(id: string, tParam?: string | null): ParsedVideo {
  const start = tParam ? parseTimeToSeconds(tParam) : undefined;
  const params = new URLSearchParams({ rel: "0", modestbranding: "1" });
  if (start) params.set("start", String(start));
  return {
    kind: "youtube",
    id,
    start,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    providerName: PROVIDER_LABELS.youtube,
  };
}

/**
 * True if URL should be rendered as a native <video> element (uploaded file or
 * direct .mp4/.webm path), false for provider iframes (YouTube/Vimeo/...).
 *
 * Server-safe (no DOM access) so both server components (lesson page
 * autoComplete config) and client components (LessonContent player) can call.
 */
export function isNativeVideoUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/")) return true; // same-origin path (uploaded file)
  const v = parseVideoUrl(trimmed);
  return v === null || v.kind === "file";
}
