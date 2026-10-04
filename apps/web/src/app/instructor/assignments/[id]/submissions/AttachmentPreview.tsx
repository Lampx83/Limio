"use client";

import { ExternalLink } from "lucide-react";
import {
  extractVimeoId,
  extractYouTubeId,
} from "@/app/instructor/classroom/boardNoteStyle";
import { detectAttachmentKind, googleEmbedUrl } from "./attachmentKind";

function hostOf(url: string): string {
  try {
    return new URL(url, "http://local").hostname === "local"
      ? "File đã nộp"
      : new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Xem trước file đính kèm của bài nộp ngay trong màn hình chấm, để GV không
 * phải chuyển qua lại giữa tab file và form chấm. Loại không xem được
 * (zip, json, trang web ngoài…) rơi về thẻ link + nút mở tab mới.
 */
export default function AttachmentPreview({ url }: { url: string }) {
  const kind = detectAttachmentKind(url);

  const openLink = (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-secondary btn-sm inline-flex items-center gap-1.5"
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      {kind === "link" || kind === "google" ? "Mở trong tab mới" : "Mở tab mới / tải về"}
    </a>
  );

  let body: React.ReactNode;
  switch (kind) {
    case "pdf":
      body = (
        <iframe
          src={url}
          title="Xem trước PDF bài nộp"
          className="h-[60vh] w-full rounded-xl border border-token bg-white lg:h-[75vh]"
        />
      );
      break;
    case "image":
      body = (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={url}
            alt="Ảnh bài nộp"
            loading="lazy"
            className="max-h-[75vh] w-full rounded-xl border border-token bg-white object-contain"
          />
        </a>
      );
      break;
    case "video":
      body = (
        <video
          src={url}
          controls
          preload="metadata"
          className="max-h-[75vh] w-full rounded-xl bg-black"
        />
      );
      break;
    case "audio":
      body = <audio src={url} controls preload="metadata" className="w-full" />;
      break;
    case "google": {
      const src = googleEmbedUrl(url);
      body = src ? (
        <div className="space-y-2">
          <iframe
            src={src}
            title="Xem trước tài liệu Google"
            loading="lazy"
            className="h-[60vh] w-full rounded-xl border border-token bg-white lg:h-[75vh]"
          />
          <p className="text-xs text-faint">
            Nếu khung trống hoặc hiện trang đăng nhập, tài liệu chưa mở quyền
            “Bất kỳ ai có đường liên kết” — mở tab mới hoặc nhờ sinh viên chia sẻ lại.
          </p>
        </div>
      ) : null;
      break;
    }
    case "youtube":
    case "vimeo": {
      const id = kind === "youtube" ? extractYouTubeId(url) : extractVimeoId(url);
      body = id ? (
        <div className="relative aspect-video">
          <iframe
            src={
              kind === "youtube"
                ? `https://www.youtube.com/embed/${id}`
                : `https://player.vimeo.com/video/${id}`
            }
            title="Video bài nộp"
            loading="lazy"
            allowFullScreen
            className="absolute inset-0 h-full w-full rounded-xl"
          />
        </div>
      ) : null;
      break;
    }
    default:
      body = (
        <div className="rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4">
          <p className="text-sm font-medium">{hostOf(url)}</p>
          <p className="mt-1 break-all text-xs text-faint">{url}</p>
        </div>
      );
  }

  return (
    <div className="space-y-2">
      {body}
      <div>{openLink}</div>
    </div>
  );
}
