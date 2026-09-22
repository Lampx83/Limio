"use client";

/**
 * Inline edit form for an existing ContentItem. Mirrors the field UI of
 * AddContentItemForm but pre-fills from the existing payload and PATCHes
 * `/api/contents/[id]` instead of POSTing.
 *
 * Scope:
 *   - markdown / video / embed / file / external_link / pdf  → full edit
 *   - scorm / h5p / lti                                      → only `title`
 *     (changing the underlying package/tool requires recreate, since the
 *     instructor flow couples upload → pick → bind in AddContentItemForm.)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";
import AiFormatPanel from "@/components/AiFormatPanel";

const PdfViewer = dynamic(() => import("@/components/PdfViewer"), {
  ssr: false,
});

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});

type ContentType =
  | "video"
  | "markdown"
  | "richtext"
  | "embed"
  | "file"
  | "external_link"
  | "pdf"
  | "scorm"
  | "lti"
  | "h5p"
  | "html_block";

interface Props {
  item: {
    id: string;
    type: string;
    payload: unknown;
  };
  lessonId: string;
  onClose: () => void;
}

export default function EditContentItemForm({ item, lessonId, onClose }: Props) {
  const router = useRouter();
  const type = item.type as ContentType;
  const initial = (item.payload ?? {}) as Record<string, unknown>;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Common scalar fields, pre-filled from the existing payload.
  const [body, setBody] = useState<string>(String(initial.body ?? ""));
  const [html, setHtml] = useState<string>(String(initial.html ?? ""));
  const [url, setUrl] = useState<string>(String(initial.url ?? ""));
  const [filename, setFilename] = useState<string>(String(initial.filename ?? ""));
  const [linkTitle, setLinkTitle] = useState<string>(String(initial.title ?? ""));
  const [htmlBlockBody, setHtmlBlockBody] = useState<string>(
    String(initial.body ?? ""),
  );

  /**
   * "Áp dụng và lưu" trong AiFormatPanel gọi thẳng đây — PATCH ngay với HTML
   * đã AI định dạng, bỏ qua nút "Lưu" chung của form. CHỈ lưu — AiFormatPanel
   * tự chuyển sang màn "Đã lưu bài học" + nút "Đóng form" gọi onClose (prop
   * có sẵn của form này) khi GV bấm, không tự đóng ở đây.
   */
  async function saveRichtextViaAi(formattedHtml: string) {
    const res = await fetch(apiUrl(`/api/contents/${item.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: { html: formattedHtml } }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error((d as { error?: string }).error ?? `http_${res.status}`);
    }
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    let payload: Record<string, unknown>;
    switch (type) {
      case "markdown":
        payload = { body };
        break;
      case "richtext":
        if (!html.trim()) {
          setError("empty_content");
          setBusy(false);
          return;
        }
        payload = { html };
        break;
      case "video":
      case "embed":
        payload = { url };
        break;
      case "file":
        payload = { url, filename };
        break;
      case "external_link":
      case "pdf":
        payload = { url, title: linkTitle.trim() || undefined };
        break;
      case "html_block":
        payload = {
          url,
          title: linkTitle.trim() || undefined,
          body: htmlBlockBody.trim() || undefined,
        };
        break;
      case "scorm":
        payload = {
          ...(initial as { packageId: string }),
          title: linkTitle.trim() || undefined,
        };
        break;
      case "h5p":
        payload = {
          ...(initial as { packageId: string }),
          title: linkTitle.trim() || undefined,
        };
        break;
      case "lti":
        payload = {
          ...(initial as { toolId: string }),
          title: linkTitle.trim() || undefined,
        };
        break;
      default:
        setError(`unsupported_type:${type}`);
        setBusy(false);
        return;
    }

    let res: Response;
    try {
      res = await fetch(apiUrl(`/api/contents/${item.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
    } catch (networkErr) {
      setBusy(false);
      console.error("[EditContentItemForm] network error", networkErr);
      const msg = "Không kết nối được tới server";
      setError(msg);
      toast.error(msg);
      return;
    }
    setBusy(false);
    if (res.ok) {
      toast.success("Đã cập nhật content");
      router.refresh();
      onClose();
      return;
    }
    const d = await res.json().catch(() => ({}));
    const code = (d as { error?: string }).error ?? `http_${res.status}`;
    console.error("[EditContentItemForm] update failed", res.status, d);
    setError(code);
    toast.error(`Cập nhật thất bại: ${code}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-brand-200 bg-brand-soft/30 p-3"
    >
      <div className="flex items-center gap-2 text-xs">
        <span className="chip-brand">Sửa {type}</span>
      </div>

      {type === "markdown" && (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={6}
          placeholder="Nội dung markdown..."
          className="textarea"
        />
      )}

      {type === "richtext" && (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-faint">
              Nội dung
            </label>
            <RichTextEditor value={html} onChange={setHtml} />
          </div>
          <AiFormatPanel
            lessonId={lessonId}
            html={html}
            onSaved={saveRichtextViaAi}
            onClose={onClose}
          />
        </div>
      )}

      {(type === "video" ||
        type === "embed" ||
        type === "file" ||
        type === "external_link" ||
        type === "pdf") && (
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          type="url"
          placeholder="URL"
          className="input"
        />
      )}

      {type === "file" && (
        <input
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          required
          maxLength={200}
          placeholder="Tên file"
          className="input"
        />
      )}

      {(type === "external_link" ||
        type === "pdf" ||
        type === "scorm" ||
        type === "h5p" ||
        type === "lti") && (
        <input
          value={linkTitle}
          onChange={(e) => setLinkTitle(e.target.value)}
          maxLength={200}
          placeholder="Tiêu đề (optional)"
          className="input"
        />
      )}

      {/* Cùng thứ tự với AddContentItemForm: tiêu đề + mô tả (nội dung học
          viên đọc) trước, URL file (chi tiết kỹ thuật) sau. */}
      {type === "html_block" && (
        <>
          <input
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            maxLength={200}
            placeholder="Tiêu đề — sẽ hiện thành link bấm mở được (dòng trên cùng)"
            className="input"
          />
          <RichTextEditor
            value={htmlBlockBody}
            onChange={setHtmlBlockBody}
            placeholder="Mô tả (optional) — hiện ngay dưới tiêu đề"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            // URL là same-origin upload path (/api/lesson-media/html/<file>)
            // — type="url" sẽ reject giá trị dạng path thuần.
            type="text"
            placeholder="URL"
            className="input"
          />
        </>
      )}

      {type === "pdf" && url.trim() && (
        <div className="rounded-lg border border-token bg-[rgb(var(--surface-muted))/0.4] p-3">
          <PdfViewer url={url.trim()} title={linkTitle || undefined} />
        </div>
      )}

      {(type === "scorm" || type === "h5p" || type === "lti") && (
        <p className="text-xs text-muted">
          Chỉ chỉnh được tiêu đề. Để đổi package/tool, hãy xoá rồi tạo lại
          content này.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-token pt-3">
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "..." : "Lưu"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary btn-sm"
        >
          Hủy
        </button>
        {error && (
          <span className="text-xs text-danger-600">Lỗi: {error}</span>
        )}
      </div>
    </form>
  );
}
