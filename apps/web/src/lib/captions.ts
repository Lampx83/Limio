/**
 * Phụ đề (captions) tuỳ chọn cho video tải lên (phát bằng `<video>` gốc).
 *
 * Payload video có `transcriptUrl` là file `.vtt` cùng-origin (do `/api/lesson-media/transcripts` phục vụ)
 * thì player gắn nó làm `<track kind="subtitles">`: nút CC của trình duyệt bật/tắt được, MẶC ĐỊNH TẮT
 * (không có `default`). Video YouTube/Vimeo… (iframe) không dùng được track nên không đi qua đây.
 *
 * Module thuần, an toàn cho cả server lẫn client.
 */
import { isNativeVideoUrl } from "./videoUrl";

export interface CaptionTrack {
  src: string;
  /** BCP-47 */
  srcLang: string;
  label: string;
}

export const DEFAULT_CAPTION_LANG = "en";

export interface CaptionSource {
  url?: string | null;
  transcriptUrl?: string | null;
  captionLang?: string | null;
  captionLabel?: string | null;
}

/** `.vtt` (bỏ ?query/#hash). `.srt` không dùng được làm `<track>`. */
function isVttPath(u: string): boolean {
  return /\.vtt$/i.test(u.split(/[?#]/)[0] ?? "");
}

/** Đường dẫn cùng-origin (`/api/...`) — không nhận `//host` (protocol-relative) hay URL tuyệt đối. */
function isSameOriginPath(u: string): boolean {
  return u.startsWith("/") && !u.startsWith("//");
}

function labelFor(lang: string): string {
  try {
    const name = new Intl.DisplayNames(["en"], { type: "language" }).of(lang);
    if (name && name !== lang) return name;
  } catch {
    /* mã ngôn ngữ lạ / môi trường không có Intl.DisplayNames */
  }
  return lang;
}

/**
 * Trả track phụ đề cho một video, hoặc null nếu không áp dụng (video của nhà cung cấp, không có
 * transcript, transcript không phải `.vtt`, hoặc không cùng-origin).
 */
export function captionTrackFor(p: CaptionSource): CaptionTrack | null {
  const url = p.url?.trim();
  const src = p.transcriptUrl?.trim();
  if (!url || !src) return null;
  if (!isNativeVideoUrl(url)) return null;
  if (!isVttPath(src) || !isSameOriginPath(src)) return null;
  const srcLang = p.captionLang?.trim() || DEFAULT_CAPTION_LANG;
  const label = p.captionLabel?.trim() || labelFor(srcLang);
  return { src, srcLang, label };
}

/** Content-Type khi phục vụ file transcript: `.vtt` phải là `text/vtt` để `<track>` nhận. */
export function transcriptContentType(filename: string): string {
  return /\.vtt$/i.test(filename) ? "text/vtt; charset=utf-8" : "text/plain; charset=utf-8";
}
