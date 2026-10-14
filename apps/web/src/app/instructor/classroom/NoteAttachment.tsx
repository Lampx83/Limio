"use client";

import { ExternalLink } from "lucide-react";
import {
  detectMediaKind,
  extractYouTubeId,
  extractVimeoId,
} from "./boardNoteStyle";

// Ảnh do board lưu (png/jpg/webp; GIF động không có thumbnail nên để nguyên).
const BOARD_UPLOAD_IMAGE_RE = /\/api\/board-attachments\/[A-Za-z0-9._-]+\.(png|jpe?g|webp)$/;
// `<boardId>-<w>x<h>-<unixMs>-<hex>.<ext>`
const DIMS_RE = /-(\d{2,5})x(\d{2,5})-\d{10,}-[A-Za-z0-9]+\.[A-Za-z0-9]+$/;

interface Props {
  url: string;
}

export default function NoteAttachment({ url }: Props) {
  const kind = detectMediaKind(url);

  if (kind === "image") {
    // Ảnh upload lên board: nạp thumbnail (480/960px) thay vì bản gốc; bấm vào mới mở bản lớn.
    const isBoardUpload = BOARD_UPLOAD_IMAGE_RE.test(url);
    // Kích thước nhúng trong tên file → giữ khung đúng tỉ lệ trước khi ảnh về, bố cục masonry không nhảy.
    const dims = DIMS_RE.exec(url);
    const ratio = dims ? Number(dims[1]) / Number(dims[2]) : null;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block -mx-4 -mt-4 mb-3">
        <img
          src={isBoardUpload ? `${url}?w=480` : url}
          srcSet={isBoardUpload ? `${url}?w=480 480w, ${url}?w=960 960w` : undefined}
          sizes={isBoardUpload ? "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" : undefined}
          width={dims ? Number(dims[1]) : undefined}
          height={dims ? Number(dims[2]) : undefined}
          alt=""
          loading="lazy"
          decoding="async"
          style={ratio ? { aspectRatio: String(ratio) } : undefined}
          className="w-full max-h-72 object-cover rounded-t-xl bg-white/40"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </a>
    );
  }

  if (kind === "video") {
    return (
      <div className="-mx-4 -mt-4 mb-3">
        <video
          src={url}
          controls
          preload="metadata"
          className="w-full max-h-72 rounded-t-xl bg-black"
        />
      </div>
    );
  }

  if (kind === "audio") {
    return (
      <div className="mb-3">
        <audio src={url} controls preload="metadata" className="w-full" />
      </div>
    );
  }

  if (kind === "youtube") {
    const id = extractYouTubeId(url);
    if (!id) return null;
    return (
      <div className="-mx-4 -mt-4 mb-3 relative aspect-video">
        <iframe
          src={`https://www.youtube.com/embed/${id}`}
          title="YouTube video"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full rounded-t-xl"
        />
      </div>
    );
  }

  if (kind === "vimeo") {
    const id = extractVimeoId(url);
    if (!id) return null;
    return (
      <div className="-mx-4 -mt-4 mb-3 relative aspect-video">
        <iframe
          src={`https://player.vimeo.com/video/${id}`}
          title="Vimeo video"
          loading="lazy"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full rounded-t-xl"
        />
      </div>
    );
  }

  // Plain link — hiển thị chip với hostname
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* keep raw */
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-800 bg-white/70 hover:bg-white px-2.5 py-1 rounded-full mb-2 backdrop-blur transition-colors"
    >
      <ExternalLink size={12} />
      <span className="truncate max-w-[12rem]">{host}</span>
    </a>
  );
}
