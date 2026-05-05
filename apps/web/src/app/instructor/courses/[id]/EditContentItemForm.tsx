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
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";

type ContentType =
  | "video"
  | "markdown"
  | "embed"
  | "file"
  | "external_link"
  | "pdf"
  | "scorm"
  | "lti"
  | "h5p";

interface Props {
  item: {
    id: string;
    type: string;
    payload: unknown;
  };
  onClose: () => void;
}

export default function EditContentItemForm({ item, onClose }: Props) {
  const router = useRouter();
  const type = item.type as ContentType;
  const initial = (item.payload ?? {}) as Record<string, unknown>;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Common scalar fields, pre-filled from the existing payload.
  const [body, setBody] = useState<string>(String(initial.body ?? ""));
  const [url, setUrl] = useState<string>(String(initial.url ?? ""));
  const [filename, setFilename] = useState<string>(String(initial.filename ?? ""));
  const [linkTitle, setLinkTitle] = useState<string>(String(initial.title ?? ""));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    let payload: Record<string, unknown>;
    switch (type) {
      case "markdown":
        payload = { body };
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
