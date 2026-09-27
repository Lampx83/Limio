import { safeHref } from "@/lib/safeUrl";

const IMAGE = /\.(png|jpe?g|webp|gif|svg)$/i;
const VIDEO = /\.(mp4|webm|mov)$/i;
const AUDIO = /\.(mp3|ogg|wav)$/i;

/** A8 — tệp đính kèm của bài nộp: ảnh/video/âm thanh hiện trực tiếp, loại khác thành link. */
export default function PortfolioAttachment({ url }: { url: string | null }) {
  const href = safeHref(url);
  if (!href) return null;
  const path = href.split("?")[0]!;
  if (IMAGE.test(path)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={href} alt="Ảnh bài nộp" loading="lazy" className="mt-3 max-h-96 w-full rounded-lg border border-token object-contain" />
    );
  }
  if (VIDEO.test(path)) {
    return <video src={href} controls preload="metadata" className="mt-3 w-full rounded-lg border border-token" />;
  }
  if (AUDIO.test(path)) {
    return <audio src={href} controls preload="metadata" className="mt-3 w-full" />;
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">
      Mở tệp đính kèm ↗
    </a>
  );
}
