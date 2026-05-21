"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { parseVideoUrl } from "@/lib/videoUrl";
import { apiUrl } from "@/lib/apiUrl";

const PdfViewer = dynamic(() => import("@/components/PdfViewer"), {
  ssr: false,
});

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});

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

interface SkillRow {
  id: string;
  code: string;
  name: string;
}

interface CuepointInlineDraft {
  uid: string;
  mode: "inline";
  atSec: number;
  prompt: string;
  options: { label: string; isCorrect: boolean }[];
  skillIds: string[];
  points: number;
  explanation: string;
}

interface CuepointExistingDraft {
  uid: string;
  mode: "existing";
  atSec: number;
  quizId: string;
}

type CuepointDraft = CuepointInlineDraft | CuepointExistingDraft;

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
  | "h5p";

const TYPE_LABEL: Record<ContentType, string> = {
  richtext: "Văn bản (rich text)",
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
  embedded = false,
  onCancel,
  lockedType,
}: {
  lessonId: string;
  nextOrderIndex: number;
  embedded?: boolean;
  onCancel?: () => void;
  lockedType?: ContentType;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(embedded);

  function close() {
    if (embedded) onCancel?.();
    else setOpen(false);
  }

  const [type, setType] = useState<ContentType>(lockedType ?? "markdown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");
  const [html, setHtml] = useState("");
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
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [cuepoints, setCuepoints] = useState<CuepointDraft[]>([]);

  useEffect(() => {
    if (!open) return;
    if (type === "scorm") {
      fetch(apiUrl("/api/scorm-packages"))
        .then((r) => r.json())
        .then((d) => setScormPackages(d.packages ?? []))
        .catch(() => {});
    }
    if (type === "h5p") {
      fetch(apiUrl("/api/h5p-packages"))
        .then((r) => r.json())
        .then((d) => setH5pPackages(d.packages ?? []))
        .catch(() => {});
    }
    if (type === "lti") {
      fetch(apiUrl("/api/lti-tools"))
        .then((r) => r.json())
        .then((d) => setLtiTools(d.tools ?? []))
        .catch(() => {});
    }
    if (type === "video") {
      fetch(apiUrl(`/api/lessons/${lessonId}/quizzes`))
        .then((r) => r.json())
        .then((d) => setLessonQuizzes(d.quizzes ?? []))
        .catch(() => {});
      fetch(apiUrl("/api/skills"))
        .then((r) => r.json())
        .then((d) => setSkills(d.items ?? []))
        .catch(() => {});
    }
  }, [type, open, lessonId]);

  async function uploadScormFile(file: File) {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(apiUrl("/api/scorm-packages"), { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(`upload_failed: ${d.error ?? res.status}`);
      return;
    }
    const data = await res.json();
    const fresh = await fetch(apiUrl("/api/scorm-packages")).then((r) => r.json());
    setScormPackages(fresh.packages ?? []);
    setScormPackageId(data.id);
    if (!linkTitle) setLinkTitle(data.title ?? "");
  }

  async function uploadH5pFile(file: File) {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(apiUrl("/api/h5p-packages"), { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(`upload_failed: ${d.error ?? res.status}`);
      return;
    }
    const data = await res.json();
    const fresh = await fetch(apiUrl("/api/h5p-packages")).then((r) => r.json());
    setH5pPackages(fresh.packages ?? []);
    setH5pPackageId(data.id);
    if (!linkTitle) setLinkTitle(data.title ?? "");
  }

  function reset() {
    setUrl("");
    setBody("");
    setHtml("");
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
        // Resolve inline cuepoints into quizIds by creating cuepoint quizzes
        // first. If any inline creation fails, roll back the ones already
        // created and abort the whole submit.
        // Block duplicate quizIds across "existing" cuepoints — same quizId
        // means the player would show the same questions at every cuepoint
        // (the cache is keyed by quizId).
        const existingQuizIds = cuepoints
          .filter((c): c is CuepointExistingDraft => c.mode === "existing" && !!c.quizId)
          .map((c) => c.quizId);
        const dupQuizId = existingQuizIds.find(
          (id, i) => existingQuizIds.indexOf(id) !== i,
        );
        if (dupQuizId) {
          setError(
            "duplicate_cuepoint_quiz: 2+ cuepoint đang chọn cùng 1 quiz. Mỗi cuepoint phải dùng quiz khác nhau.",
          );
          setBusy(false);
          return;
        }
        const createdQuizIds: string[] = [];
        const resolved: { atSec: number; quizId: string }[] = [];
        let failed = false;
        for (const c of cuepoints) {
          if (c.atSec < 0) continue;
          if (c.mode === "existing") {
            if (c.quizId) resolved.push({ atSec: c.atSec, quizId: c.quizId });
            continue;
          }
          // mode === "inline": validate locally before round-tripping.
          if (!c.prompt.trim()) {
            setError(`Cuepoint @ ${c.atSec}s: thiếu prompt`);
            failed = true;
            break;
          }
          if (c.skillIds.length === 0) {
            setError(`Cuepoint @ ${c.atSec}s: chọn ít nhất 1 skill`);
            failed = true;
            break;
          }
          const cleanOpts = c.options.filter((o) => o.label.trim());
          if (cleanOpts.length < 2 || !cleanOpts.some((o) => o.isCorrect)) {
            setError(`Cuepoint @ ${c.atSec}s: cần ≥2 đáp án và 1 đáp án đúng`);
            failed = true;
            break;
          }
          const res = await fetch(
            apiUrl(`/api/lessons/${lessonId}/cuepoint-quiz`),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                atSec: c.atSec,
                question: {
                  type: "mcq",
                  prompt: c.prompt.trim(),
                  points: c.points,
                  explanation: c.explanation.trim() || undefined,
                  options: cleanOpts.map((o) => ({
                    label: o.label.trim(),
                    isCorrect: o.isCorrect,
                  })),
                  skillIds: c.skillIds,
                },
              }),
            },
          );
          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            setError(`cuepoint_quiz_failed: ${d.error ?? res.status}`);
            failed = true;
            break;
          }
          const data = (await res.json()) as { quizId: string };
          createdQuizIds.push(data.quizId);
          resolved.push({ atSec: c.atSec, quizId: data.quizId });
        }
        if (failed) {
          // Roll back any cuepoint quizzes we already created.
          await Promise.all(
            createdQuizIds.map((id) =>
              fetch(apiUrl(`/api/cuepoint-quiz/${id}`), {
                method: "DELETE",
              }).catch(() => {}),
            ),
          );
          setBusy(false);
          return;
        }
        resolved.sort((a, b) => a.atSec - b.atSec);
        payload = resolved.length > 0 ? { url, cuepoints: resolved } : { url };
        break;
      }
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

    const res = await fetch(apiUrl(`/api/lessons/${lessonId}/contents`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, orderIndex: nextOrderIndex, payload }),
    });
    setBusy(false);
    if (res.ok) {
      reset();
      close();
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
      {!lockedType && (
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
      )}

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

      {type === "richtext" && (
        <RichTextEditor
          value={html}
          onChange={setHtml}
          placeholder="Nhập nội dung văn bản..."
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
                  ? "URL PDF (https://.../file.pdf) — hoặc upload file bên dưới"
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
          {type === "pdf" && (
            <PdfUploadPanel
              uploading={uploading}
              setUploading={setUploading}
              setError={setError}
              onUploaded={(uploadedUrl) => setUrl(uploadedUrl)}
            />
          )}
          {type === "video" && url.trim() && (
            <VideoUrlPreview url={url} />
          )}
          {type === "pdf" && url.trim() && (
            <div className="rounded-lg border border-token bg-[rgb(var(--surface-muted))/0.4] p-3">
              <PdfViewer url={url.trim()} title={linkTitle || undefined} />
            </div>
          )}
          {type === "video" && (
            <CuepointEditor
              cuepoints={cuepoints}
              setCuepoints={setCuepoints}
              quizzes={lessonQuizzes}
              skills={skills}
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
            close();
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
function makeInlineDraft(atSec = 0): CuepointInlineDraft {
  return {
    uid: Math.random().toString(36).slice(2, 10),
    mode: "inline",
    atSec,
    prompt: "",
    options: [
      { label: "", isCorrect: true },
      { label: "", isCorrect: false },
      { label: "", isCorrect: false },
      { label: "", isCorrect: false },
    ],
    skillIds: [],
    points: 1,
    explanation: "",
  };
}

function CuepointEditor({
  cuepoints,
  setCuepoints,
  quizzes,
  skills,
}: {
  cuepoints: CuepointDraft[];
  setCuepoints: (next: CuepointDraft[]) => void;
  quizzes: LessonQuizRow[];
  skills: SkillRow[];
}) {
  function add() {
    if (cuepoints.length >= 20) return;
    setCuepoints([...cuepoints, makeInlineDraft()]);
  }
  function remove(uid: string) {
    setCuepoints(cuepoints.filter((c) => c.uid !== uid));
  }
  function replace(uid: string, next: CuepointDraft) {
    setCuepoints(cuepoints.map((c) => (c.uid === uid ? next : c)));
  }
  // QuizIds already picked by other cuepoints — drives default selection
  // and disabled options to prevent picking the same quiz twice (which made
  // all cuepoints show the same quiz at playback).
  function usedQuizIdsBy(excludeUid: string): Set<string> {
    const used = new Set<string>();
    for (const c of cuepoints) {
      if (c.uid === excludeUid) continue;
      if (c.mode === "existing" && c.quizId) used.add(c.quizId);
    }
    return used;
  }
  function firstUnusedQuizId(excludeUid: string): string {
    const used = usedQuizIdsBy(excludeUid);
    const free = quizzes.find((q) => !used.has(q.id));
    return free?.id ?? "";
  }

  function switchMode(uid: string, mode: "inline" | "existing") {
    const cur = cuepoints.find((c) => c.uid === uid);
    if (!cur || cur.mode === mode) return;
    if (mode === "inline") {
      replace(uid, makeInlineDraft(cur.atSec));
    } else {
      replace(uid, {
        uid: cur.uid,
        mode: "existing",
        atSec: cur.atSec,
        quizId: firstUnusedQuizId(uid),
      });
    }
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
          disabled={cuepoints.length >= 20}
          className="btn-secondary btn-sm"
        >
          + Thêm cuepoint
        </button>
      </div>
      <p className="mt-1 text-[11px] text-muted">
        Player sẽ pause tại mỗi timestamp, học viên phải trả lời đúng mới được xem tiếp.
        Chỉ áp dụng cho video upload / file trực tiếp (.mp4/.webm) — YouTube/Vimeo không
        intercept được. Soạn câu hỏi tại chỗ, hoặc chọn quiz có sẵn.
      </p>
      {cuepoints.length > 0 && (
        <ul className="mt-2 space-y-3">
          {cuepoints.map((c) => (
            <li
              key={c.uid}
              className="space-y-2 rounded-md border border-token bg-[rgb(var(--surface-muted))/0.5] p-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <CuepointTimeInput
                  value={c.atSec}
                  onChange={(v) => replace(c.uid, { ...c, atSec: v })}
                />
                <div className="flex items-center gap-1 rounded-md border border-token p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => switchMode(c.uid, "inline")}
                    className={`rounded px-2 py-1 ${
                      c.mode === "inline"
                        ? "bg-brand-soft text-brand-700 font-semibold"
                        : "text-muted hover:text-fg"
                    }`}
                  >
                    Soạn mới
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode(c.uid, "existing")}
                    disabled={quizzes.length === 0}
                    className={`rounded px-2 py-1 ${
                      c.mode === "existing"
                        ? "bg-brand-soft text-brand-700 font-semibold"
                        : "text-muted hover:text-fg disabled:opacity-40"
                    }`}
                    title={quizzes.length === 0 ? "Chưa có quiz nào trên lesson" : ""}
                  >
                    Chọn có sẵn
                  </button>
                </div>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => remove(c.uid)}
                  className="btn-secondary btn-sm"
                  aria-label="Xoá cuepoint"
                >
                  Xoá
                </button>
              </div>

              {c.mode === "existing" ? (
                (() => {
                  const used = usedQuizIdsBy(c.uid);
                  const isDuplicate = c.quizId !== "" && used.has(c.quizId);
                  const allUsed = quizzes.length > 0 && quizzes.every((q) => used.has(q.id));
                  return (
                    <div className="space-y-1">
                      <select
                        value={c.quizId}
                        onChange={(e) =>
                          replace(c.uid, { ...c, quizId: e.target.value })
                        }
                        className={`select w-full ${
                          isDuplicate ? "border-danger-400 bg-danger-50" : ""
                        }`}
                      >
                        {quizzes.length === 0 && (
                          <option value="">— chưa có quiz nào —</option>
                        )}
                        {allUsed && (
                          <option value="">— hết quiz để dùng —</option>
                        )}
                        {quizzes.map((q) => {
                          const usedByOther = used.has(q.id);
                          return (
                            <option key={q.id} value={q.id} disabled={usedByOther}>
                              {q.title} ({q.questionCount} câu)
                              {usedByOther ? " — đã dùng" : ""}
                            </option>
                          );
                        })}
                      </select>
                      {isDuplicate && (
                        <p className="text-[11px] font-medium text-danger-700">
                          ⚠ Quiz này đã được cuepoint khác chọn — đổi sang quiz khác,
                          nếu không tất cả cuepoint sẽ hiện cùng câu hỏi.
                        </p>
                      )}
                    </div>
                  );
                })()
              ) : (
                <InlineCuepointQuestion
                  draft={c}
                  skills={skills}
                  onChange={(next) => replace(c.uid, next)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InlineCuepointQuestion({
  draft,
  skills,
  onChange,
}: {
  draft: CuepointInlineDraft;
  skills: SkillRow[];
  onChange: (next: CuepointInlineDraft) => void;
}) {
  // Local-only preview state: instructor picks an answer and clicks "Kiểm tra"
  // to verify the question works as intended before saving. Pure client-side —
  // matches against the draft's isCorrect flags, no API call.
  const [previewing, setPreviewing] = useState(false);
  const [previewPick, setPreviewPick] = useState<number | null>(null);
  const [previewResult, setPreviewResult] = useState<"correct" | "wrong" | null>(null);

  if (previewing) {
    const cleanOpts = draft.options
      .map((o, i) => ({ ...o, idx: i }))
      .filter((o) => o.label.trim());
    const promptEmpty = !draft.prompt.trim();
    const noCorrect = !draft.options.some((o) => o.isCorrect);
    return (
      <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/40">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            Thử như học viên (chưa save)
          </span>
          <button
            type="button"
            onClick={() => {
              setPreviewing(false);
              setPreviewPick(null);
              setPreviewResult(null);
            }}
            className="text-xs text-muted hover:text-fg"
          >
            ← Quay lại soạn
          </button>
        </div>
        {promptEmpty || cleanOpts.length < 2 || noCorrect ? (
          <p className="text-xs text-danger-600">
            Chưa đủ dữ liệu để thử: cần prompt, ≥2 đáp án và 1 đáp án đúng.
          </p>
        ) : (
          <>
            <p className="text-sm font-medium">{draft.prompt}</p>
            <ul className="space-y-1">
              {cleanOpts.map((o) => (
                <li key={o.idx}>
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-1.5 text-sm ${
                      previewResult && previewPick === o.idx
                        ? o.isCorrect
                          ? "border-success-500 bg-success-50"
                          : "border-danger-500 bg-danger-50"
                        : previewResult && o.isCorrect
                          ? "border-success-500 bg-success-50/40"
                          : "border-token bg-[rgb(var(--surface))]"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`preview-${draft.uid}`}
                      checked={previewPick === o.idx}
                      onChange={() => {
                        setPreviewPick(o.idx);
                        setPreviewResult(null);
                      }}
                      disabled={previewResult !== null}
                    />
                    <span>{o.label}</span>
                    {previewResult && o.isCorrect && (
                      <span className="ml-auto text-xs font-semibold text-success-700">
                        đáp án đúng
                      </span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 pt-1">
              {previewResult === null ? (
                <button
                  type="button"
                  disabled={previewPick === null}
                  onClick={() => {
                    if (previewPick === null) return;
                    setPreviewResult(
                      draft.options[previewPick]?.isCorrect ? "correct" : "wrong",
                    );
                  }}
                  className="btn-primary btn-sm"
                >
                  Kiểm tra
                </button>
              ) : (
                <>
                  <span
                    className={`text-sm font-semibold ${
                      previewResult === "correct"
                        ? "text-success-700"
                        : "text-danger-700"
                    }`}
                  >
                    {previewResult === "correct" ? "✓ Đúng" : "✗ Sai"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewPick(null);
                      setPreviewResult(null);
                    }}
                    className="btn-secondary btn-sm"
                  >
                    Thử lại
                  </button>
                </>
              )}
            </div>
            {previewResult && draft.explanation.trim() && (
              <p className="text-xs text-muted">
                <span className="font-semibold">Giải thích:</span> {draft.explanation}
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-dashed border-token bg-[rgb(var(--surface))] p-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setPreviewing(true)}
          className="text-xs text-brand-700 hover:underline"
          title="Thử câu hỏi như học viên (không gửi server)"
        >
          ▶ Thử câu hỏi
        </button>
      </div>
      <textarea
        value={draft.prompt}
        onChange={(e) => onChange({ ...draft, prompt: e.target.value })}
        rows={2}
        placeholder="Câu hỏi (prompt)..."
        className="textarea w-full"
      />
      <ul className="space-y-1">
        {draft.options.map((o, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name={`correct-${draft.uid}`}
              checked={o.isCorrect}
              onChange={() =>
                onChange({
                  ...draft,
                  options: draft.options.map((opt, j) => ({
                    ...opt,
                    isCorrect: i === j,
                  })),
                })
              }
              aria-label="Đáp án đúng"
            />
            <input
              type="text"
              value={o.label}
              onChange={(e) =>
                onChange({
                  ...draft,
                  options: draft.options.map((opt, j) =>
                    i === j ? { ...opt, label: e.target.value } : opt,
                  ),
                })
              }
              placeholder={`Đáp án ${String.fromCharCode(65 + i)}`}
              className="input flex-1"
            />
            {draft.options.length > 2 && (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...draft,
                    options: draft.options.filter((_, j) => i !== j),
                  })
                }
                className="text-xs text-muted hover:text-danger-600"
                aria-label="Xoá đáp án"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      {draft.options.length < 6 && (
        <button
          type="button"
          onClick={() =>
            onChange({
              ...draft,
              options: [...draft.options, { label: "", isCorrect: false }],
            })
          }
          className="text-xs text-brand-700 hover:underline"
        >
          + Thêm đáp án
        </button>
      )}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-faint">
          Skill (bắt buộc ≥1)
        </label>
        {skills.length === 0 ? (
          <p className="mt-1 text-xs text-accent-700">
            Chưa có skill nào trong course — tạo skill ở tab Skills trước.
          </p>
        ) : (
          <div className="mt-1 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
            {skills.map((s) => {
              const picked = draft.skillIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...draft,
                      skillIds: picked
                        ? draft.skillIds.filter((x) => x !== s.id)
                        : [...draft.skillIds, s.id],
                    })
                  }
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    picked
                      ? "border-brand-300 bg-brand-soft text-brand-700"
                      : "border-token text-muted hover:border-brand-300"
                  }`}
                  title={s.code}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <input
        type="text"
        value={draft.explanation}
        onChange={(e) => onChange({ ...draft, explanation: e.target.value })}
        placeholder="Giải thích (optional)"
        className="input w-full text-xs"
      />
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
      res = await fetch(apiUrl("/api/lesson-media/videos"), {
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

const PDF_MAX_MB = 50;

function PdfUploadPanel({
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
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);

    // Pre-flight check: catch oversize file before sending it over the network.
    if (file.size > PDF_MAX_MB * 1024 * 1024) {
      setUploading(false);
      setError(
        `File quá lớn (${sizeMb} MB). Giới hạn của hệ thống là ${PDF_MAX_MB} MB.`,
      );
      return;
    }

    const fd = new FormData();
    fd.append("file", file);
    let res: Response;
    try {
      res = await fetch(apiUrl("/api/lesson-media/pdfs"), {
        method: "POST",
        body: fd,
      });
    } catch (networkErr) {
      setUploading(false);
      console.error("[PdfUploadPanel] network error", networkErr);
      setError("network_error");
      return;
    }
    setUploading(false);
    if (!res.ok) {
      // 413 with a JSON error means our own route rejected it (file_too_large).
      // 413 without JSON means the reverse proxy stripped the body before it
      // reached Next.js — proxy body-size limit is the culprit, not our cap.
      const ct = res.headers.get("content-type") ?? "";
      const d = ct.includes("application/json")
        ? ((await res.json().catch(() => ({}))) as { error?: string })
        : {};
      if (res.status === 413) {
        if (d.error === "file_too_large") {
          setError(
            `File quá lớn (${sizeMb} MB). Giới hạn của hệ thống là ${PDF_MAX_MB} MB.`,
          );
        } else {
          setError(
            `Reverse proxy chặn upload (413). File ${sizeMb} MB vượt giới hạn body của proxy — báo admin tăng client_max_body_size lên ≥ ${PDF_MAX_MB} MB.`,
          );
        }
        return;
      }
      setError(`upload_failed: ${d.error ?? res.status}`);
      return;
    }
    const data = (await res.json()) as { url: string };
    onUploaded(data.url);
  }

  return (
    <div className="rounded-lg border border-dashed border-token bg-[rgb(var(--surface-muted))/0.5] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-faint">
        Hoặc upload file PDF từ máy
      </p>
      <input
        type="file"
        accept="application/pdf,.pdf"
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
      <p className="mt-2 text-[11px] text-muted">
        Chỉ nhận file <span className="font-mono font-semibold text-faint">PDF</span>
        {" · "}tối đa <span className="font-semibold">{PDF_MAX_MB} MB</span>
      </p>
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
