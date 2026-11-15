import { translate, type UiLang } from "@/lib/i18n/core";
import { EN, VI } from "@/lib/i18n/dict";

/**
 * LANG G7a.1 — ghi âm trong trình duyệt (MediaRecorder). Phần thuần: chọn định dạng, đồng hồ, lời nhắn lỗi.
 */

export const MAX_RECORD_SECONDS = 180;

/** Thứ tự ưu tiên: webm/opus (Chrome, Firefox, Edge) → mp4 (Safari/iPhone) → ogg. Khớp danh sách MIME của upload. */
const PREFERRED = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export function pickRecorderMime(isTypeSupported: (t: string) => boolean): string | undefined {
  return PREFERRED.find((t) => isTypeSupported(t));
}

export function extForRecorderMime(mime: string): "webm" | "m4a" | "ogg" {
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function recorderErrorText(name: string, lang: UiLang = "vi"): string {
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return translate(VI, EN, lang, "practice.rec.err.denied");
    case "NotFoundError":
      return translate(VI, EN, lang, "practice.rec.err.notFound");
    case "unsupported":
      return translate(VI, EN, lang, "practice.rec.err.unsupported");
    default:
      return translate(VI, EN, lang, "practice.rec.err.other");
  }
}
