"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseVideoUrl } from "@/lib/videoUrl";

interface ScormPackageRow {
  id: string;
  title: string;
  originalName: string;
  uploadedAt: string;
}

interface H5pPackageRow {
  id: string;
  title: string;
  mainLibrary: string;
  originalName: string;
  uploadedAt: string;
}

interface LtiToolRow {
  id: string;
  name: string;
  toolUrl: string;
  clientId: string;
}

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

const TYPE_LABEL: Record<ContentType, string> = {
  markdown: "Markdown",
  video: "Video",
  embed: "Embed",
  file: "File",
  external_link: "External link",
  pdf: "PDF",
  scorm: "SCORM",
  lti: "LTI 1.3",
  h5p: "H5P",
};

export default function AddContentItemForm({
  lessonId,
  nextOrderIndex,
}: {
  lessonId: string;
  nextOrderIndex: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ContentType>("markdown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");
  const [filename, setFilename] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [scormPackages, setScormPackages] = useState<ScormPackageRow[]>([]);
  const [scormPackageId, setScormPackageId] = useState("");
  const [h5pPackages, setH5pPackages] = useState<H5pPackageRow[]>([]);
  const [h5pPackageId, setH5pPackageId] = useState("");
  const [ltiTools, setLtiTools] = useState<LtiToolRow[]>([]);
  const [ltiToolId, setLtiToolId] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (type === "scorm") {
      fetch("/api/scorm-packages")
        .then((r) => r.json())
        .then((d) => setScormPackages(d.packages ?? []))
        .catch(() => {});
    }
    if (type === "h5p") {
      fetch("/api/h5p-packages")
        .then((r) => r.json())
        .then((d) => setH5pPackages(d.packages ?? []))
        .catch(() => {});
    }
    if (type === "lti") {
      fetch("/api/lti-tools")
        .then((r) => r.json())
        .then((d) => setLtiTools(d.tools ?? []))
        .catch(() => {});
    }
  }, [type, open]);

  async function uploadScormFile(file: File) {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/scorm-packages", { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(`upload_failed: ${d.error ?? res.status}`);
      return;
    }
    const data = await res.json();
    const fresh = await fetch("/api/scorm-packages").then((r) => r.json());
    setScormPackages(fresh.packages ?? []);
    setScormPackageId(data.id);
    if (!linkTitle) setLinkTitle(data.title ?? "");
  }

  async function uploadH5pFile(file: File) {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/h5p-packages", { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(`upload_failed: ${d.error ?? res.status}`);
      return;
    }
    const data = await res.json();
    const fresh = await fetch("/api/h5p-packages").then((r) => r.json());
    setH5pPackages(fresh.packages ?? []);
    setH5pPackageId(data.id);
    if (!linkTitle) setLinkTitle(data.title ?? "");
  }

  function reset() {
    setUrl("");
    setBody("");
    setFilename("");
    setLinkTitle("");
    setScormPackageId("");
    setH5pPackageId("");
    setLtiToolId("");
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    let payload: Record<string, unknown>;
    switch (type) {
      case "video":
        payload = { url };
        break;
      case "markdown":
        payload = { body };
        break;
      case "embed":
        payload = { url };
        break;
      case "file":
        payload = { url, filename };
        break;
      case "external_link":
        payload = { url, title: linkTitle.trim() || undefined };
        break;
      case "pdf":
        payload = { url, title: linkTitle.trim() || undefined };
        break;
      case "scorm":
        if (!scormPackageId) {
          setError("missing_scorm_package");
          setBusy(false);
          return;
        }
        payload = {
          packageId: scormPackageId,
          title: linkTitle.trim() || undefined,
        };
        break;
      case "h5p":
        if (!h5pPackageId) {
          setError("missing_h5p_package");
          setBusy(false);
          return;
        }
        payload = {
          packageId: h5pPackageId,
          title: linkTitle.trim() || undefined,
        };
        break;
      case "lti":
        if (!ltiToolId) {
          setError("missing_lti_tool");
          setBusy(false);
          return;
        }
        payload = {
          toolId: ltiToolId,
          title: linkTitle.trim() || undefined,
        };
        break;
    }

    const res = await fetch(`/api/lessons/${lessonId}/contents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, orderIndex: nextOrderIndex, payload }),
    });
    setBusy(false);
    if (res.ok) {
      reset();
      setOpen(false);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "create_failed");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-token bg-[rgb(var(--surface))] py-2 text-sm font-medium text-muted transition-colors hover:border-brand-300 hover:bg-brand-soft hover:text-brand-700"
      >
        + Thêm content (video, markdown, file, SCORM, H5P, LTI...)
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-3"
    >
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-faint">
          Loại
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ContentType)}
          className="select max-w-[180px]"
        >
          {(Object.keys(TYPE_LABEL) as ContentType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      {type === "markdown" && (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={4}
          placeholder="Nội dung markdown..."
          className="textarea"
        />
      )}

      {(type === "video" ||
        type === "embed" ||
        type === "file" ||
        type === "external_link" ||
        type === "pdf") && (
        <div className="space-y-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            type="url"
            placeholder={
              type === "video"
                ? "YouTube · Vimeo · Loom · Wistia · Bunny · Mux · hoặc file .mp4"
                : type === "pdf"
                  ? "URL PDF (https://.../file.pdf)"
                  : "URL"
            }
            className="input"
          />
          {type === "video" && url.trim() && (
            <VideoUrlPreview url={url} />
          )}
        </div>
      )}

      {type === "pdf" && (
        <input
          value={linkTitle}
          onChange={(e) => setLinkTitle(e.target.value)}
          maxLength={200}
          placeholder="Tiêu đề PDF (optional)"
          className="input"
        />
      )}

      {type === "scorm" && (
        <div className="space-y-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-faint">
              Chọn SCORM package có sẵn
            </label>
            <select
              value={scormPackageId}
              onChange={(e) => setScormPackageId(e.target.value)}
              className="select mt-1"
            >
              <option value="">— chưa chọn —</option>
              {scormPackages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.originalName})
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg border border-dashed border-token bg-[rgb(var(--surface))] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">
              Hoặc upload SCORM 1.2 (.zip) mới
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadScormFile(f);
              }}
              className="mt-2 text-xs file:mr-2 file:rounded file:border-0 file:bg-brand-soft file:px-2 file:py-1 file:text-brand-700"
            />
            {uploading && (
              <p className="mt-1 text-xs text-muted">Đang upload...</p>
            )}
          </div>
          <input
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            maxLength={200}
            placeholder="Tiêu đề hiển thị (optional, default = title từ manifest)"
            className="input"
          />
        </div>
      )}

      {type === "h5p" && (
        <div className="space-y-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-faint">
              Chọn H5P package có sẵn
            </label>
            <select
              value={h5pPackageId}
              onChange={(e) => setH5pPackageId(e.target.value)}
              className="select mt-1"
            >
              <option value="">— chưa chọn —</option>
              {h5pPackages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.mainLibrary})
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg border border-dashed border-token bg-[rgb(var(--surface))] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">
              Hoặc upload .h5p mới
            </p>
            <input
              type="file"
              accept=".h5p,application/zip"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadH5pFile(f);
              }}
              className="mt-2 text-xs file:mr-2 file:rounded file:border-0 file:bg-brand-soft file:px-2 file:py-1 file:text-brand-700"
            />
            {uploading && (
              <p className="mt-1 text-xs text-muted">Đang upload...</p>
            )}
          </div>
          <input
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            maxLength={200}
            placeholder="Tiêu đề hiển thị (optional)"
            className="input"
          />
        </div>
      )}

      {type === "lti" && (
        <div className="space-y-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-faint">
              Chọn LTI 1.3 tool
            </label>
            <select
              value={ltiToolId}
              onChange={(e) => setLtiToolId(e.target.value)}
              className="select mt-1"
            >
              <option value="">— chưa chọn —</option>
              {ltiTools.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.toolUrl})
                </option>
              ))}
            </select>
            {ltiTools.length === 0 && (
              <p className="mt-1 text-xs text-accent-700">
                Chưa có tool nào. Admin cần đăng ký tool ở /admin/lti-tools trước.
              </p>
            )}
          </div>
          <input
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            maxLength={200}
            placeholder="Tiêu đề hiển thị (optional)"
            className="input"
          />
        </div>
      )}

      {type === "file" && (
        <input
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          required
          maxLength={200}
          placeholder="Tên file (eg. handout.pdf)"
          className="input"
        />
      )}

      {type === "external_link" && (
        <input
          value={linkTitle}
          onChange={(e) => setLinkTitle(e.target.value)}
          maxLength={200}
          placeholder="Tiêu đề (optional)"
          className="input"
        />
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-token pt-3">
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "..." : "Tạo"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
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

function VideoUrlPreview({ url }: { url: string }) {
  const v = parseVideoUrl(url);

  if (!v) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-xs text-accent-700">
        <span aria-hidden></span>
        <span>
          URL chưa nhận diện được provider. Hệ thống sẽ thử mở như video file
          (.mp4/.webm). Hỗ trợ: YouTube, Vimeo, Loom, Wistia, Bunny, Mux.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-success-100 bg-success-50 p-2.5">
      {v.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={v.thumbnailUrl}
          alt=""
          className="h-12 w-20 shrink-0 rounded-md border border-success-200 bg-black object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-md bg-success-100 text-2xl">
                  </div>
      )}
      <div className="min-w-0 flex-1 text-xs">
        <p className="font-semibold text-success-700">
          ✓ {v.providerName}
        </p>
        <p className="mt-0.5 font-mono text-success-700/80 truncate">
          ID: {v.id}
          {v.start ? ` · bắt đầu ${v.start}s` : ""}
        </p>
        <p className="mt-0.5 text-success-700/70">
          Sẽ hiển thị bằng iframe embed.
        </p>
      </div>
    </div>
  );
}
