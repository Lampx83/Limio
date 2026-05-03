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

interface LessonQuizRow {
  id: string;
  title: string;
  questionCount: number;
}

interface CuepointDraft {
  /** Local key for React list rendering. Not sent to server. */
  uid: string;
  atSec: number;
  quizId: string;
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
  // In-video cuepoint editor state — only used when type === "video".
  const [lessonQuizzes, setLessonQuizzes] = useState<LessonQuizRow[]>([]);
  const [cuepoints, setCuepoints] = useState<CuepointDraft[]>([]);

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
    if (type === "video") {
      fetch(`/api/lessons/${lessonId}/quizzes`)
        .then((r) => r.json())
        .then((d) => setLessonQuizzes(d.quizzes ?? []))
        .catch(() => {});
    }
  }, [type, open, lessonId]);

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
    setCuepoints([]);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    let payload: Record<string, unknown>;
    switch (type) {
      case "video": {
        // Validate cuepoints client-side: every row must have a quiz selected
        // and atSec >= 0. Server re-validates against the full schema.
        const validCuepoints = cuepoints
          .filter((c) => c.quizId && c.atSec >= 0)
          .map((c) => ({ atSec: c.atSec, quizId: c.quizId }))
          .sort((a, b) => a.atSec - b.atSec);
        payload =
          validCuepoints.length > 0
            ? { url, cuepoints: validCuepoints }
            : { url };
        break;
      }
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
            // For video / file / pdf the URL may be a same-origin path
            // (e.g. /api/lesson-media/videos/<file>) populated by the upload
            // panel below. type="url" rejects path-only values, so we use
            // type="text" for those and keep type="url" for purely-external
            // fields (embed, external_link).
            type={
              type === "embed" || type === "external_link" ? "url" : "text"
            }
            placeholder={
              type === "video"
                ? "Dán URL: YouTube · Vimeo · Loom · Wistia · Bunny · Mux — hoặc upload file bên dưới"
                : type === "pdf"
                  ? "URL PDF (https://.../file.pdf) — hoặc tự host"
                  : "URL"
            }
            className="input"
          />
          {type === "video" && (
            <VideoUploadPanel
              uploading={uploading}
              setUploading={setUploading}
              setError={setError}
              onUploaded={(uploadedUrl) => setUrl(uploadedUrl)}
            />
          )}
          {type === "video" && url.trim() && (
            <VideoUrlPreview url={url} />
          )}
          {type === "video" && (
            <CuepointEditor
              cuepoints={cuepoints}
              setCuepoints={setCuepoints}
              quizzes={lessonQuizzes}
            />
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

/**
 * In-video cuepoint editor. Each row binds a timestamp (mm:ss) to a
 * Quiz on the same lesson — when the learner's playback reaches that
 * timestamp the player pauses and forces them to answer that quiz.
 *
 * Only meaningful for native <video> playback (uploaded files / direct
 * URL); provider iframes (YouTube/Vimeo/...) ignore cuepoints.
 */
function CuepointEditor({
  cuepoints,
  setCuepoints,
  quizzes,
}: {
  cuepoints: CuepointDraft[];
  setCuepoints: (next: CuepointDraft[]) => void;
  quizzes: LessonQuizRow[];
}) {
  function add() {
    if (cuepoints.length >= 20) return;
    setCuepoints([
      ...cuepoints,
      {
        uid: Math.random().toString(36).slice(2, 10),
        atSec: 0,
        quizId: quizzes[0]?.id ?? "",
      },
    ]);
  }
  function remove(uid: string) {
    setCuepoints(cuepoints.filter((c) => c.uid !== uid));
  }
  function update(uid: string, patch: Partial<CuepointDraft>) {
    setCuepoints(cuepoints.map((c) => (c.uid === uid ? { ...c, ...patch } : c)));
  }

  return (
    <div className="rounded-lg border border-token bg-[rgb(var(--surface))] p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">
          Câu hỏi gài trong video ({cuepoints.length})
        </p>
        <button
          type="button"
          onClick={add}
          disabled={quizzes.length === 0 || cuepoints.length >= 20}
          className="btn-secondary btn-sm"
        >
          + Thêm cuepoint
        </button>
      </div>
      {quizzes.length === 0 ? (
        <p className="mt-2 text-xs text-muted">
          Chưa có quiz nào trong lesson — tạo quiz trước rồi gài vào timestamp ở đây.
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-muted">
          Player sẽ pause tại mỗi timestamp, học viên phải trả lời đúng quiz được chọn
          mới được xem tiếp. Chỉ áp dụng cho video upload / file trực tiếp (.mp4/.webm) —
          YouTube/Vimeo không intercept được.
        </p>
      )}
      {cuepoints.length > 0 && (
        <ul className="mt-2 space-y-2">
          {cuepoints.map((c) => (
            <li
              key={c.uid}
              className="flex flex-wrap items-center gap-2 rounded-md border border-token bg-[rgb(var(--surface-muted))/0.5] p-2"
            >
              <CuepointTimeInput
                value={c.atSec}
                onChange={(v) => update(c.uid, { atSec: v })}
              />
              <select
                value={c.quizId}
                onChange={(e) => update(c.uid, { quizId: e.target.value })}
                className="select min-w-[200px] flex-1"
              >
                {quizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title} ({q.questionCount} câu)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => remove(c.uid)}
                className="btn-secondary btn-sm"
                aria-label="Xoá cuepoint"
              >
                Xoá
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CuepointTimeInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  function format(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }
  function parse(text: string): number | null {
    // Accept "mm:ss" or "ss". Reject anything else.
    const trimmed = text.trim();
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    const m = /^(\d+):([0-5]?\d)$/.exec(trimmed);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }
  const [text, setText] = useState(format(value));
  return (
    <input
      type="text"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const parsed = parse(e.target.value);
        if (parsed !== null) onChange(parsed);
      }}
      onBlur={() => setText(format(value))}
      placeholder="mm:ss"
      title="Định dạng mm:ss (vd 01:30) hoặc số giây thuần"
      className="input w-24 font-mono text-center"
    />
  );
}

/**
 * Video file uploader. Shown alongside the URL input on the "video"
 * type — instructors can either paste a provider URL (YouTube/Vimeo/...)
 * or upload a raw file from their machine. On successful upload we
 * push the resulting `/api/lesson-media/videos/<file>` URL into the
 * shared `url` field so the rest of the create flow proceeds unchanged.
 */
const VIDEO_UPLOAD_FORMATS = [
  { ext: "MP4", note: "khuyến nghị, H.264/H.265" },
  { ext: "WebM", note: "VP8/VP9" },
  { ext: "MOV", note: "QuickTime" },
  { ext: "MKV", note: "" },
  { ext: "OGV", note: "Ogg Theora" },
];

const VIDEO_UPLOAD_ACCEPT =
  "video/mp4,video/webm,video/ogg,video/quicktime,video/x-matroska,.mp4,.webm,.ogv,.mov,.mkv";

function VideoUploadPanel({
  uploading,
  setUploading,
  setError,
  onUploaded,
}: {
  uploading: boolean;
  setUploading: (v: boolean) => void;
  setError: (v: string | null) => void;
  onUploaded: (url: string) => void;
}) {
  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    let res: Response;
    try {
      res = await fetch("/api/lesson-media/videos", {
        method: "POST",
        body: fd,
      });
    } catch (networkErr) {
      setUploading(false);
      console.error("[VideoUploadPanel] network error", networkErr);
      setError("network_error");
      return;
    }
    setUploading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(`upload_failed: ${(d as { error?: string }).error ?? res.status}`);
      return;
    }
    const data = (await res.json()) as { url: string };
    onUploaded(data.url);
  }

  return (
    <div className="rounded-lg border border-dashed border-token bg-[rgb(var(--surface-muted))/0.5] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-faint">
        Hoặc upload file video từ máy
      </p>
      <input
        type="file"
        accept={VIDEO_UPLOAD_ACCEPT}
        disabled={uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
        className="mt-2 block w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:font-medium file:text-brand-700 hover:file:bg-brand-100"
      />
      {uploading && (
        <p className="mt-1 text-xs text-muted">Đang upload...</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        <span className="font-semibold uppercase tracking-wide">Định dạng hỗ trợ:</span>
        {VIDEO_UPLOAD_FORMATS.map((f) => (
          <span key={f.ext}>
            <span className="font-mono font-semibold text-faint">{f.ext}</span>
            {f.note && <span className="text-muted"> ({f.note})</span>}
          </span>
        ))}
        <span className="text-faint">· tối đa 500 MB</span>
      </div>
    </div>
  );
}

function VideoUrlPreview({ url }: { url: string }) {
  const trimmed = url.trim();

  // Same-origin uploaded file (populated by VideoUploadPanel). Show a
  // confirm card instead of the "unrecognized provider" warning, since
  // we know exactly what this is.
  if (trimmed.startsWith("/api/lesson-media/videos/")) {
    const filename = trimmed.split("/").pop() ?? trimmed;
    return (
      <div className="flex items-start gap-3 rounded-lg border border-success-100 bg-success-50 p-2.5 text-xs">
        <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-md bg-success-100 font-mono text-success-700">
          file
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-success-700">
            ✓ Đã upload, sẽ phát bằng player nội bộ
          </p>
          <p className="mt-0.5 font-mono text-success-700/80 truncate">
            {filename}
          </p>
        </div>
      </div>
    );
  }

  const v = parseVideoUrl(trimmed);

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
