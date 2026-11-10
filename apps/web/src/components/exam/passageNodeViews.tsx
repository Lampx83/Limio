"use client";

import { createContext, useContext } from "react";
import type { AnyExtension, Node as TiptapNode } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { Mic, Trash2, Video } from "lucide-react";
import { examAssetFilenameFromUrl, videoTranscriptKey } from "@/lib/examAssetUrl";
import { PASSAGE_EXTENSIONS } from "@/lib/passageDoc";

/**
 * Cách ảnh, audio và video hiện TRONG ô soạn Đoạn văn: có nút "Xoá" ngay trên khối, ảnh vừa khung (cùng quy tắc với phía học viên),
 * thẻ audio có nhãn transcript và nút "Transcript". Chỉ dùng ở trình soạn (cần giao diện); lib/passageDoc.ts giữ nguyên cho phần
 * chuyển đổi không giao diện. docs/tieu-chi/bai-doc-anh-audio-xoa-transcript.md (AC1–AC3).
 */
export interface PassageMediaActions {
  /** Tên tệp audio của đề → đã có transcript hay chưa. Audio không có trong bảng này (tệp ngoài) thì không có ô transcript. */
  transcriptFlags: Record<string, boolean>;
  onEditTranscript: (src: string, alt: string, kind: "audio" | "video") => void;
}
export const PassageMediaContext = createContext<PassageMediaActions | null>(null);

const deleteBtn =
  "inline-flex items-center gap-1 rounded-md border border-token bg-[rgb(var(--surface))] px-2 py-1 text-xs font-medium text-red-700 shadow-sm hover:bg-red-50";

function ImageView({ node, selected, deleteNode }: NodeViewProps) {
  const src = String(node.attrs.src ?? "");
  const alt = String(node.attrs.alt ?? "");
  return (
    <NodeViewWrapper className="my-3 flex justify-center" data-testid="passage-image-view">
      <div className={`group relative inline-block max-w-full ${selected ? "rounded-md ring-2 ring-brand-400" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} draggable={false} className="mx-auto block max-h-[28rem] w-auto max-w-full rounded-md border border-default object-contain" />
        {/* Điện thoại không có rê chuột: nút luôn hiện; máy tính hiện khi rê/chọn/focus. */}
        <button
          type="button"
          onClick={() => deleteNode()}
          aria-label="Xoá ảnh"
          className={`absolute right-2 top-2 ${deleteBtn} sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 ${selected ? "sm:opacity-100" : ""}`}
        >
          <Trash2 size={13} aria-hidden /> Xoá
        </button>
      </div>
    </NodeViewWrapper>
  );
}

function MediaView({ node, selected, deleteNode, kind }: NodeViewProps & { kind: "audio" | "video" }) {
  const ctx = useContext(PassageMediaContext);
  const src = String(node.attrs.src ?? "");
  const alt = String(node.attrs.alt ?? "");
  // Audio: chỉ tệp của kho đề mới có ô transcript (tệp ngoài thì không). Video (tải lên hoặc link): luôn nhập được.
  const name = kind === "audio" ? examAssetFilenameFromUrl(src) : videoTranscriptKey(src);
  const known = !!name && !!ctx && (kind === "video" || name in ctx.transcriptFlags);
  const has = known && !!ctx!.transcriptFlags[name!];
  const Icon = kind === "audio" ? Mic : Video;
  return (
    <NodeViewWrapper
      className={`passage-media-chip flex-wrap ${selected ? "ring-2 ring-brand-400" : ""}`}
      data-testid={`passage-${kind}-view`}
    >
      <Icon size={16} aria-hidden className="shrink-0 text-faint" />
      <span className="min-w-0 flex-1 break-words">{alt || (kind === "audio" ? "Audio" : "Video")}</span>
      {known && (
        <span className={`text-xs ${has ? "text-emerald-700" : "text-faint"}`}>{has ? "Có transcript" : "Chưa có transcript"}</span>
      )}
      <span className="flex shrink-0 gap-1.5">
        {known && (
          <button
            type="button"
            onClick={() => ctx!.onEditTranscript(src, alt, kind)}
            className="rounded-md border border-token bg-[rgb(var(--surface))] px-2 py-1 text-xs font-medium hover:bg-[rgb(var(--surface-muted))]"
          >
            Transcript
          </button>
        )}
        <button type="button" onClick={() => deleteNode()} aria-label={kind === "audio" ? "Xoá audio" : "Xoá video"} className={deleteBtn}>
          <Trash2 size={13} aria-hidden /> Xoá
        </button>
      </span>
    </NodeViewWrapper>
  );
}

/** Bộ nút của trình soạn Đoạn văn: như PASSAGE_EXTENSIONS nhưng ảnh/audio/video vẽ bằng giao diện có nút Xoá. */
export const PASSAGE_EDITOR_EXTENSIONS: AnyExtension[] = (PASSAGE_EXTENSIONS as AnyExtension[]).map((ext) => {
  const node = ext as TiptapNode;
  if (ext.name === "image") return node.extend({ addNodeView: () => ReactNodeViewRenderer(ImageView) });
  if (ext.name === "audio") return node.extend({ addNodeView: () => ReactNodeViewRenderer((p: NodeViewProps) => <MediaView {...p} kind="audio" />) });
  if (ext.name === "video") return node.extend({ addNodeView: () => ReactNodeViewRenderer((p: NodeViewProps) => <MediaView {...p} kind="video" />) });
  return ext;
});
