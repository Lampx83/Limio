"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

  // Per-type fields (kept simple — one form, conditional fields).
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
    // Refresh list + auto-select.
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
        className="text-xs text-slate-500 underline hover:text-slate-700 dark:hover:text-slate-300"
      >
        + Thêm content
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-2 rounded border border-slate-300 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/40"
    >
      <div className="flex items-center gap-2">
        <label className="font-medium uppercase text-slate-500">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ContentType)}
          className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
        >
          <option value="markdown">markdown</option>
          <option value="video">video</option>
          <option value="embed">embed</option>
          <option value="file">file</option>
          <option value="external_link">external_link</option>
          <option value="pdf">pdf</option>
          <option value="scorm">scorm</option>
          <option value="lti">lti</option>
          <option value="h5p">h5p</option>
        </select>
      </div>

      {type === "markdown" && (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={4}
          placeholder="Nội dung markdown..."
          className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
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
          placeholder={
            type === "pdf"
              ? "URL PDF (https://.../file.pdf)"
              : "URL"
          }
          className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
        />
      )}

      {type === "pdf" && (
        <input
          value={linkTitle}
          onChange={(e) => setLinkTitle(e.target.value)}
          maxLength={200}
          placeholder="Tiêu đề PDF (optional)"
          className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
        />
      )}

      {type === "scorm" && (
        <div className="space-y-2">
          <div>
            <label className="font-medium uppercase text-slate-500">
              Chọn SCORM package có sẵn
            </label>
            <select
              value={scormPackageId}
              onChange={(e) => setScormPackageId(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
            >
              <option value="">— chưa chọn —</option>
              {scormPackages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.originalName})
                </option>
              ))}
            </select>
          </div>
          <div className="rounded border border-slate-200 p-2 dark:border-slate-800">
            <p className="text-[11px] uppercase text-slate-500">
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
              className="mt-1 text-xs"
            />
            {uploading && (
              <p className="mt-1 text-[11px] text-slate-500">Đang upload...</p>
            )}
          </div>
          <input
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            maxLength={200}
            placeholder="Tiêu đề hiển thị (optional, default = title từ manifest)"
            className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
          />
        </div>
      )}

      {type === "h5p" && (
        <div className="space-y-2">
          <div>
            <label className="font-medium uppercase text-slate-500">
              Chọn H5P package có sẵn
            </label>
            <select
              value={h5pPackageId}
              onChange={(e) => setH5pPackageId(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
            >
              <option value="">— chưa chọn —</option>
              {h5pPackages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.mainLibrary})
                </option>
              ))}
            </select>
          </div>
          <div className="rounded border border-slate-200 p-2 dark:border-slate-800">
            <p className="text-[11px] uppercase text-slate-500">
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
              className="mt-1 text-xs"
            />
            {uploading && (
              <p className="mt-1 text-[11px] text-slate-500">Đang upload...</p>
            )}
          </div>
          <input
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            maxLength={200}
            placeholder="Tiêu đề hiển thị (optional)"
            className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
          />
        </div>
      )}

      {type === "lti" && (
        <div className="space-y-2">
          <div>
            <label className="font-medium uppercase text-slate-500">
              Chọn LTI 1.3 tool
            </label>
            <select
              value={ltiToolId}
              onChange={(e) => setLtiToolId(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
            >
              <option value="">— chưa chọn —</option>
              {ltiTools.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.toolUrl})
                </option>
              ))}
            </select>
            {ltiTools.length === 0 && (
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                Chưa có tool nào. Admin cần đăng ký tool ở /admin/lti-tools
                trước.
              </p>
            )}
          </div>
          <input
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            maxLength={200}
            placeholder="Tiêu đề hiển thị (optional)"
            className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
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
          className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
        />
      )}

      {type === "external_link" && (
        <input
          value={linkTitle}
          onChange={(e) => setLinkTitle(e.target.value)}
          maxLength={200}
          placeholder="Tiêu đề (optional)"
          className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
        />
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-slate-900 px-2 py-1 font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {busy ? "..." : "Tạo"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700"
        >
          Hủy
        </button>
        {error && <span className="text-red-600">Lỗi: {error}</span>}
      </div>
    </form>
  );
}
