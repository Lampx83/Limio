"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  PenLine,
  Hash,
  Film,
  FileText,
  Paperclip,
  Link2,
  Globe2,
  Code2,
  type LucideIcon,
} from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";
import { RESOURCE_TYPE_LABELS, type ResourceType } from "./ResourceContent";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), { ssr: false });

export const RESOURCE_TYPE_ICONS: Record<ResourceType, LucideIcon> = {
  richtext: PenLine,
  markdown: Hash,
  video: Film,
  pdf: FileText,
  file: Paperclip,
  external_link: Link2,
  embed: Globe2,
  html_block: Code2,
};

export const RESOURCE_TYPE_HINTS: Record<ResourceType, string> = {
  richtext: "Soạn thảo trực quan — bold, list, link, heading",
  markdown: "Viết markdown thô — cho người quen cú pháp",
  video: "Dán link YouTube/Vimeo hoặc upload file",
  pdf: "Xem PDF ngay trong slide này (không tách trang thành slide riêng)",
  file: "Tài liệu để học viên tải xuống",
  external_link: "Trỏ tới website/tài liệu bên ngoài",
  embed: "Hiện 1 trang web ngay trong slide — Google Slides, Canva, Form… (dán link)",
  html_block: "Upload 1 file .html, mở trong tab riêng (sandbox)",
};

export const RESOURCE_TYPES: ResourceType[] = [
  "richtext",
  "markdown",
  "video",
  "pdf",
  "file",
  "external_link",
  "embed",
  "html_block",
];

export function ResourceTypePicker({ onPick, onClose }: { onPick: (type: ResourceType) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-token bg-[rgb(var(--surface))] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-base font-bold">Chèn tài nguyên</h3>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {RESOURCE_TYPES.map((type) => {
            const Icon = RESOURCE_TYPE_ICONS[type];
            return (
              <button
                key={type}
                onClick={() => onPick(type)}
                className="rounded-xl border border-token p-3.5 text-left transition hover:border-brand-400 hover:bg-brand-50/50"
              >
                <Icon size={20} className="mb-2 text-brand-600" />
                <p className="text-sm font-semibold">{RESOURCE_TYPE_LABELS[type]}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted">{RESOURCE_TYPE_HINTS[type]}</p>
              </button>
            );
          })}
        </div>
        <button onClick={onClose} className="btn-text mt-4 text-xs">
          Huỷ
        </button>
      </div>
    </div>
  );
}

async function uploadResourceFile(file: File, kind: string): Promise<{ url: string; filename: string; sizeBytes: number; mimeType: string }> {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", file);
  const res = await fetch(apiUrl("/api/instructor/limio-live/resource-upload"), { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "upload_failed");
  }
  return res.json();
}

/**
 * Form soạn payload theo từng loại tài nguyên — cùng payload shape với
 * contentSchemas.ts (packages/core-lms) để tái dùng validate phía server.
 */
export function ResourceAuthorForm({
  type,
  payload,
  onChange,
}: {
  type: ResourceType;
  payload: Record<string, any>;
  onChange: (payload: Record<string, any>) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File, kind: string) => {
    setUploading(true);
    try {
      const uploaded = await uploadResourceFile(file, kind);
      if (type === "file") {
        onChange({ ...payload, url: uploaded.url, filename: uploaded.filename, sizeBytes: uploaded.sizeBytes, mimeType: uploaded.mimeType });
      } else {
        onChange({ ...payload, url: uploaded.url });
      }
      toast.success("Đã tải file lên");
    } catch {
      toast.error("Tải file thất bại — kiểm tra định dạng/kích thước");
    } finally {
      setUploading(false);
    }
  };

  if (type === "richtext") {
    return (
      <RichTextEditor
        value={payload.html ?? ""}
        onChange={(html) => onChange({ ...payload, html })}
        placeholder="Soạn nội dung..."
        minHeight={220}
      />
    );
  }

  if (type === "markdown") {
    return (
      <textarea
        value={payload.body ?? ""}
        onChange={(e) => onChange({ ...payload, body: e.target.value })}
        placeholder="# Tiêu đề&#10;&#10;Viết markdown ở đây..."
        rows={10}
        className="input w-full font-mono text-xs"
      />
    );
  }

  if (type === "external_link" || type === "embed") {
    return (
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium">URL</label>
          <input
            type="url"
            value={payload.url ?? ""}
            onChange={(e) => onChange({ ...payload, url: e.target.value })}
            placeholder="https://..."
            className="input w-full"
          />
        </div>
        {type === "external_link" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Tiêu đề <span className="font-normal text-muted">(tuỳ chọn)</span>
            </label>
            <input
              type="text"
              value={payload.title ?? ""}
              onChange={(e) => onChange({ ...payload, title: e.target.value })}
              className="input w-full"
            />
          </div>
        )}
        {type === "embed" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Chiều cao (px) <span className="font-normal text-muted">(tuỳ chọn, mặc định 480)</span>
            </label>
            <input
              type="number"
              min={100}
              value={payload.height ?? ""}
              onChange={(e) => onChange({ ...payload, height: e.target.value ? parseInt(e.target.value) : undefined })}
              className="input w-32"
            />
          </div>
        )}
      </div>
    );
  }

  if (type === "video") {
    return (
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Link YouTube/Vimeo hoặc URL video</label>
          <input
            type="url"
            value={payload.url ?? ""}
            onChange={(e) => onChange({ ...payload, url: e.target.value })}
            placeholder="https://youtube.com/watch?v=..."
            className="input w-full"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>hoặc</span>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-secondary btn-sm"
          >
            {uploading ? "Đang tải..." : "Upload file video (≤50MB)"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) handleFileUpload(f, "video");
            }}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Tiêu đề <span className="font-normal text-muted">(tuỳ chọn)</span>
          </label>
          <input
            type="text"
            value={payload.title ?? ""}
            onChange={(e) => onChange({ ...payload, title: e.target.value })}
            className="input w-full"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Chú thích <span className="font-normal text-muted">(tuỳ chọn)</span>
          </label>
          <input
            type="text"
            value={payload.caption ?? ""}
            onChange={(e) => onChange({ ...payload, caption: e.target.value })}
            className="input w-full"
          />
        </div>
      </div>
    );
  }

  if (type === "pdf" || type === "html_block" || type === "file") {
    const kind = type;
    const accept = type === "pdf" ? "application/pdf" : type === "html_block" ? "text/html" : undefined;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-secondary btn-sm">
            {uploading ? "Đang tải..." : payload.url ? "Đổi file" : "Chọn file"}
          </button>
          {payload.url && (
            <span className="truncate text-xs text-muted">{payload.filename || payload.url}</span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) handleFileUpload(f, kind);
            }}
          />
        </div>
        {type === "pdf" && (
          <p className="text-[11px] leading-snug text-faint">
            PDF này hiển thị gọn trong slide hiện tại (có nút lật trang riêng). Muốn mỗi trang
            thành 1 slide để lật cùng nhịp với cả bài giảng — dùng "Tách PDF thành nhiều slide" ở
            danh sách slide bên trái thay vì mục này.
          </p>
        )}
        {type !== "file" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Tiêu đề <span className="font-normal text-muted">(tuỳ chọn)</span>
            </label>
            <input
              type="text"
              value={payload.title ?? ""}
              onChange={(e) => onChange({ ...payload, title: e.target.value })}
              className="input w-full"
            />
          </div>
        )}
        {type === "html_block" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Mô tả <span className="font-normal text-muted">(tuỳ chọn, hiện phía trên link)</span>
            </label>
            <textarea
              value={payload.body ?? ""}
              onChange={(e) => onChange({ ...payload, body: e.target.value })}
              rows={2}
              className="input w-full"
            />
          </div>
        )}
      </div>
    );
  }

  return null;
}
