"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Editor } from "@tiptap/react";
import dynamic from "next/dynamic";
import { Link2, Music, Video } from "lucide-react";
import TranscriptDialog from "@/components/exam/TranscriptDialog";
import { downscaleImage } from "@/lib/downscaleImage";
import { checkAudioFile, checkImageFile, checkVideoFile } from "@/lib/mediaLimits";
import { videoUploadErrorMessage } from "@/lib/videoUpload";
import { examAssetFilenameFromUrl, videoTranscriptKey } from "@/lib/examAssetUrl";
import { apiUrl } from "@/lib/apiUrl";
import SkillPicker from "./SkillPicker";
import { renderDoc, type TiptapDoc } from "@/components/exam/PassageView";
import { PASSAGE_TABLE_MAX_COLS, PASSAGE_TABLE_MAX_ROWS, findUnsupported, htmlToPassageDocChecked, passageDocToHtml, unsupportedLabels } from "@/lib/passageDoc";

// Trình soạn Tiptap chỉ chạy ở trình duyệt (cần DOM).
const PassageRichEditor = dynamic(() => import("@/components/exam/PassageRichEditor"), {
  ssr: false,
  loading: () => <div className="rounded-lg border border-token bg-[rgb(var(--surface))] p-3 text-sm text-faint">Đang tải trình soạn…</div>,
});

interface Skill {
  id: string;
  code: string;
  name: string;
}

interface PassageInput {
  title: string;
  audioPolicy: "free_replay" | "limited_replay" | "once_only";
  maxAudioPlays: number;
  revealMode: "all_at_once" | "sequential";
  skills: Skill[];
}

interface Props {
  mode: "create" | "edit";
  examId: string;
  passageId?: string;
  initial?: {
    title: string;
    contentJson: unknown;
    audioPolicy: PassageInput["audioPolicy"];
    maxAudioPlays: number | null;
    revealMode: PassageInput["revealMode"];
    skills: Skill[];
  };
  onClose: () => void;
  /** Bài luyện trong bài học: ẩn ô "Hiển thị" và "Skill liên quan" (không có nghĩa với bài luyện). */
  practiceMode?: boolean;
}

const EMPTY: PassageInput = {
  title: "",
  audioPolicy: "free_replay",
  maxAudioPlays: 2,
  revealMode: "all_at_once",
  skills: [],
};

export default function PassageEditor({ mode, examId, passageId, initial, onClose, practiceMode = false }: Props) {
  const router = useRouter();
  const [v, setV] = useState<PassageInput>(() =>
    initial
      ? {
          title: initial.title,
          audioPolicy: initial.audioPolicy,
          maxAudioPlays: initial.maxAudioPlays ?? 2,
          revealMode: initial.revealMode,
          skills: initial.skills,
        }
      : EMPTY,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Nội dung: Tiptap JSON ↔ HTML của trình soạn (lib/passageDoc.ts). Đoạn có nút trình soạn chưa hỗ trợ thì giữ nguyên và chỉ hiện bản xem,
  // trừ khi người soạn chủ động chuyển sang soạn (mất phần đó khi lưu). Chưa sửa gì thì không gửi lại nội dung — đoạn cũ không bị đổi một chữ.
  const initialDoc = initial?.contentJson as TiptapDoc | undefined;
  const [unsupported] = useState<string[]>(() => (initialDoc ? findUnsupported(initialDoc) : []));
  const [forceEdit, setForceEdit] = useState(false);
  const readOnlyContent = unsupported.length > 0 && !forceEdit;
  const [html, setHtml] = useState<string>(() =>
    initialDoc && typeof document !== "undefined" && findUnsupported(initialDoc).length === 0 ? passageDocToHtml(initialDoc) : "",
  );
  const [dirty, setDirty] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  // Audio của đề → đã có transcript (cho nhãn trên thẻ audio); hộp thoại tải audio và sửa transcript.
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  // Hộp thoại đang mở để thêm audio/video (tệp hoặc link) kèm mô tả và transcript.
  const [pendingMedia, setPendingMedia] = useState<{ kind: "audio" | "video-file"; file: File | null } | { kind: "video-link" } | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [editingTranscript, setEditingTranscript] = useState<{ kind: "audio" | "video"; key: string; src: string; alt: string; transcript: string | null } | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    void fetch(apiUrl(`/api/exams/${examId}/assets`))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { transcripts?: Record<string, boolean> } | null) => {
        if (!off && d?.transcripts) setFlags(d.transcripts);
      })
      .catch(() => undefined);
    return () => {
      off = true;
    };
  }, [examId]);

  /** Chèn khối audio/video tại con trỏ của trình soạn. */
  function insertMedia(type: "audio" | "video", src: string, alt: string) {
    const ed = editorRef.current;
    if (!ed) {
      window.alert("Trình soạn chưa sẵn sàng, thử lại sau giây lát.");
      return;
    }
    // Kèm một đoạn trống phía sau để con trỏ rời khỏi khối: nếu khối còn được chọn thì lần chèn kế tiếp (ảnh, audio…) sẽ thay thế nó.
    ed.chain().focus().insertContent([{ type, attrs: { src, alt } }, { type: "paragraph" }]).run();
  }

  /** Chuyển đoạn có phần chưa hỗ trợ sang trình soạn: phần đó mất khi lưu (người soạn đã xác nhận). */
  function startEditingAnyway() {
    if (!initialDoc) return;
    if (!window.confirm(`Chuyển sang trình soạn sẽ xoá phần chưa hỗ trợ (${unsupportedLabels(unsupported).join(", ")}) khi bạn lưu. Vẫn chuyển?`)) return;
    setHtml(passageDocToHtml(initialDoc));
    setDirty(true);
    setForceEdit(true);
  }

  /** Tải ảnh lên cho trình soạn: hỏi mô tả (bắt buộc), trả URL; huỷ hoặc lỗi thì null. */
  async function uploadImage(file: File): Promise<{ url: string; alt: string } | null> {
    const toSend = await downscaleImage(file); // ảnh quá lớn thu về cạnh dài 2000 px trước khi tải (dung lượng tính trên tệp này)
    const problem = checkImageFile(toSend);
    if (problem) {
      window.alert(problem);
      return null;
    }
    const alt = window.prompt("Mô tả ảnh (alt text) — bắt buộc cho accessibility:", "");
    if (alt === null) return null;
    const trimmed = alt.trim();
    if (!trimmed) {
      window.alert("Alt text không được để trống.");
      return null;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", toSend);
      form.append("altText", trimmed);
      const res = await fetch(apiUrl(`/api/exams/${examId}/assets`), { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        window.alert(`Upload lỗi: ${data?.error ?? res.status}`);
        return null;
      }
      return { url: data.url as string, alt: trimmed };
    } finally {
      setUploading(false);
    }
  }

  /** "Dán link video": mở hộp thoại hỏi URL, mô tả (bắt buộc) và transcript (tuỳ chọn). */
  function onInsertVideo() {
    setDialogError(null);
    setPendingMedia({ kind: "video-link" });
  }

  /** Bấm "Tải audio" / "Tải video lên": mở hộp thoại nói rõ định dạng và dung lượng cho phép, rồi chọn tệp, mô tả, transcript trong đó. */
  function openUploadDialog(kind: "audio" | "video-file") {
    setDialogError(null);
    setPickError(null);
    setPendingMedia({ kind, file: null });
  }

  /** Chọn tệp trong hộp thoại: kiểm định dạng và dung lượng ngay, báo lỗi cạnh ô chọn (không tải lên khi sai). */
  function pickFile(f: File | null) {
    setDialogError(null);
    if (!f || !pendingMedia || pendingMedia.kind === "video-link") return;
    const problem = pendingMedia.kind === "audio" ? checkAudioFile(f) : checkVideoFile(f);
    setPickError(problem);
    setPendingMedia({ kind: pendingMedia.kind, file: problem ? null : f });
  }

  /** Lưu transcript của video đã chèn (tạo dòng lưu khi có chữ). Lỗi ở đây không làm mất khối video vừa chèn. */
  async function saveVideoTranscript(src: string, alt: string, transcript: string): Promise<boolean> {
    const res = await fetch(apiUrl(`/api/exams/${examId}/video-transcript`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ src, alt, transcript }),
    });
    return res.ok;
  }

  /** Bấm nút chính trong hộp thoại: tải tệp lên (audio/video) hoặc nhận link, chèn khối tại con trỏ, kèm transcript. */
  async function submitMedia(vals: { alt: string; transcript: string; url: string }) {
    if (!pendingMedia) return;
    if (pendingMedia.kind !== "video-link" && !pendingMedia.file) return;
    const hasText = vals.transcript.trim().length > 0;
    setDialogBusy(true);
    setDialogError(null);
    try {
      if (pendingMedia.kind === "audio") {
        setUploading(true);
        const form = new FormData();
        form.append("file", pendingMedia.file!);
        form.append("altText", vals.alt);
        if (hasText) form.append("transcript", vals.transcript.trim());
        const res = await fetch(apiUrl(`/api/exams/${examId}/assets`), { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setDialogError(`Tải lên lỗi: ${data?.error ?? res.status}`);
          return;
        }
        const name = examAssetFilenameFromUrl(data.url);
        if (name) setFlags((f) => ({ ...f, [name]: hasText }));
        insertMedia("audio", data.url as string, vals.alt);
      } else {
        let src = vals.url.trim();
        if (pendingMedia.kind === "video-file") {
          setUploading(true);
          const form = new FormData();
          form.append("file", pendingMedia.file!);
          const res = await fetch(apiUrl("/api/lesson-media/videos"), { method: "POST", body: form });
          const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
          if (!res.ok || !data.url) {
            setDialogError(videoUploadErrorMessage(data.error, res.status));
            return;
          }
          src = data.url;
        }
        insertMedia("video", src, vals.alt);
        if (hasText) {
          const ok = await saveVideoTranscript(src, vals.alt, vals.transcript).catch(() => false);
          const key = videoTranscriptKey(src);
          if (ok && key) setFlags((f) => ({ ...f, [key]: true }));
          else window.alert("Đã chèn video nhưng chưa lưu được transcript. Bấm nút \"Transcript\" trên thẻ video để nhập lại.");
        }
      }
      setPendingMedia(null);
    } catch {
      setDialogError("Không tải được (mất kết nối hoặc tệp quá nặng). Kiểm tra mạng rồi thử lại.");
    } finally {
      setDialogBusy(false);
      setUploading(false);
    }
  }

  /** Nút "Transcript" trên thẻ audio/video: nạp transcript hiện có rồi mở hộp thoại sửa. */
  async function openTranscriptEditor(src: string, alt: string, kind: "audio" | "video") {
    const key = kind === "audio" ? examAssetFilenameFromUrl(src) : videoTranscriptKey(src);
    if (!key) return;
    setDialogError(null);
    setEditingTranscript({ kind, key, src, alt, transcript: null });
    try {
      const res = await fetch(
        apiUrl(kind === "audio" ? `/api/exams/${examId}/assets/${key}` : `/api/exams/${examId}/video-transcript?src=${encodeURIComponent(src)}`),
      );
      const d = (await res.json().catch(() => ({}))) as { transcript?: string; error?: string };
      if (!res.ok) throw new Error(d.error ?? String(res.status));
      setEditingTranscript({ kind, key, src, alt, transcript: d.transcript ?? "" });
    } catch (e) {
      setEditingTranscript(null);
      window.alert(`Không mở được transcript: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function saveTranscript(vals: { transcript: string }) {
    if (!editingTranscript) return;
    setDialogBusy(true);
    setDialogError(null);
    try {
      const res =
        editingTranscript.kind === "audio"
          ? await fetch(apiUrl(`/api/exams/${examId}/assets/${editingTranscript.key}`), {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ transcript: vals.transcript }),
            })
          : await fetch(apiUrl(`/api/exams/${examId}/video-transcript`), {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ src: editingTranscript.src, alt: editingTranscript.alt, transcript: vals.transcript }),
            });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setDialogError(`Lưu lỗi: ${d.error ?? res.status}`);
        return;
      }
      setFlags((f) => ({ ...f, [editingTranscript.key]: vals.transcript.trim().length > 0 }));
      setEditingTranscript(null);
    } finally {
      setDialogBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {
      title: v.title,
      audioPolicy: v.audioPolicy,
      revealMode: v.revealMode,
      skillIds: v.skills.map((s) => s.id),
    };
    // Tạo mới: luôn gửi nội dung. Sửa: chỉ gửi khi đã sửa (đoạn cũ không bị chuyển đổi, kể cả phần trình soạn chưa hỗ trợ).
    if (mode === "create" || (dirty && !readOnlyContent)) {
      const { doc, clipped } = htmlToPassageDocChecked(html);
      if (clipped) window.alert(`Bảng vượt ${PASSAGE_TABLE_MAX_ROWS} hàng × ${PASSAGE_TABLE_MAX_COLS} cột nên đã được cắt bớt.`);
      body.contentJson = doc;
    }
    if (v.audioPolicy === "limited_replay") {
      body.maxAudioPlays = v.maxAudioPlays;
    }
    const url =
      mode === "create"
        ? `/api/exams/${examId}/passages`
        : `/api/passages/${passageId}`;
    const res = await fetch(apiUrl(url), {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(typeof d?.error === "string" ? d.error : "save_failed");
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <form
      onSubmit={save}
      className="space-y-4 rounded-lg border-2 border-blue-300 bg-blue-50 p-4"
    >
      <div>
        <label className="block text-sm font-medium">Tiêu đề đoạn</label>
        <input
          required
          value={v.title}
          onChange={(e) => setV({ ...v, title: e.target.value })}
          className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium">Nội dung</label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => openUploadDialog("audio")}
              disabled={uploading || readOnlyContent}
              className="rounded border border-default px-2 py-0.5 text-xs hover:bg-white disabled:opacity-50"
            >
              {uploading ? "Đang tải…" : <><Music className="mr-1 inline h-3.5 w-3.5 align-text-bottom" /> Tải audio</>}
            </button>
            <button
              type="button"
              onClick={onInsertVideo}
              disabled={uploading || readOnlyContent}
              className="rounded border border-default px-2 py-0.5 text-xs hover:bg-white disabled:opacity-50"
            >
              <Link2 className="mr-1 inline h-3.5 w-3.5 align-text-bottom" /> {practiceMode ? "Dán link video" : "Chèn video"}
            </button>
            {practiceMode && (
              <button
                type="button"
                onClick={() => openUploadDialog("video-file")}
                disabled={uploading || readOnlyContent}
                className="rounded border border-default px-2 py-0.5 text-xs hover:bg-white disabled:opacity-50"
              >
                <Video className="mr-1 inline h-3.5 w-3.5 align-text-bottom" /> Tải video lên
              </button>
            )}
          </div>
        </div>
        <div className="mt-1">
          {readOnlyContent && initialDoc ? (
            // Đoạn có nút trình soạn chưa hỗ trợ: giữ nguyên và chỉ hiện bản học viên thấy.
            <div className="rounded-lg border border-token bg-[rgb(var(--surface))]">
              <div className="banner-warning rounded-none border-x-0 border-t-0 px-3 py-2 text-xs">
                <p className="font-medium">Đoạn này có phần trình soạn chưa hỗ trợ ({unsupportedLabels(unsupported).join(", ")}).</p>
                <p className="mt-0.5">Mở bằng trình soạn rồi lưu sẽ mất phần đó, nên nội dung đang được giữ nguyên và chỉ hiển thị bên dưới.</p>
                <button type="button" onClick={startEditingAnyway} className="mt-1.5 rounded border border-current px-2 py-0.5 font-medium opacity-70 hover:opacity-100">
                  Vẫn dùng trình soạn
                </button>
              </div>
              <div className="prose prose-sm max-h-[28rem] max-w-none overflow-y-auto px-3 py-2 dark:prose-invert">{renderDoc(initialDoc)}</div>
            </div>
          ) : (
            <PassageRichEditor
              html={html}
              onChange={(h) => {
                setHtml(h);
                setDirty(true);
              }}
              onReady={(ed) => {
                editorRef.current = ed;
              }}
              uploadImage={uploadImage}
              media={{ transcriptFlags: flags, onEditTranscript: (src, alt, kind) => void openTranscriptEditor(src, alt, kind) }}
              placeholder="Soạn hoặc dán nội dung bài đọc ở đây (dán được cả ảnh từ clipboard)."
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="block text-sm font-medium">Phát audio (P1)</span>
          <select
            value={v.audioPolicy}
            onChange={(e) =>
              setV({ ...v, audioPolicy: e.target.value as PassageInput["audioPolicy"] })
            }
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          >
            <option value="free_replay">Nghe tự do</option>
            <option value="limited_replay">Giới hạn số lần</option>
            <option value="once_only">Nghe 1 lần</option>
          </select>
        </label>
        {v.audioPolicy === "limited_replay" && (
          <label className="block">
            <span className="block text-sm font-medium">Số lần tối đa</span>
            <input
              type="number"
              min={1}
              max={10}
              value={v.maxAudioPlays}
              onChange={(e) => setV({ ...v, maxAudioPlays: Number(e.target.value) })}
              className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
            />
          </label>
        )}
        {!practiceMode && (
        <label className="block">
          <span className="block text-sm font-medium">Hiển thị</span>
          <select
            value={v.revealMode}
            onChange={(e) =>
              setV({ ...v, revealMode: e.target.value as PassageInput["revealMode"] })
            }
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          >
            <option value="all_at_once">Cả đoạn cùng lúc</option>
            <option value="sequential">Theo từng phần (P2)</option>
          </select>
        </label>
        )}
      </div>

      {!practiceMode && (
      <div>
        <span className="block text-sm font-medium">Skill liên quan</span>
        <div className="mt-1">
          <SkillPicker value={v.skills} onChange={(s) => setV({ ...v, skills: s })} />
        </div>
      </div>
      )}

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
          Lỗi: {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-default px-4 py-1.5 text-sm"
        >
          Huỷ
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-brand-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Đang lưu…" : mode === "create" ? "Thêm đoạn" : "Lưu"}
        </button>
      </div>
      {pendingMedia && (
        <TranscriptDialog
          title={pendingMedia.kind === "audio" ? "Tải audio lên" : pendingMedia.kind === "video-file" ? "Tải video lên" : "Dán link video"}
          media={pendingMedia.kind === "audio" ? "audio" : "video"}
          askUrl={pendingMedia.kind === "video-link"}
          busy={dialogBusy}
          error={dialogError}
          submitLabel={pendingMedia.kind === "video-link" ? "Chèn video" : "Tải lên"}
          fileField={
            pendingMedia.kind === "video-link"
              ? undefined
              : {
                  accept:
                    pendingMedia.kind === "audio"
                      ? "audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/mp4"
                      : "video/mp4,video/webm,video/ogg,video/quicktime,video/x-matroska,.mp4,.webm,.ogv,.mov,.mkv",
                  file: pendingMedia.file,
                  error: pickError,
                  onPick: pickFile,
                }
          }
          onSubmit={(vals) => void submitMedia(vals)}
          onCancel={() => setPendingMedia(null)}
        />
      )}
      {editingTranscript && editingTranscript.transcript !== null && (
        <TranscriptDialog
          title={`Transcript: ${editingTranscript.alt || (editingTranscript.kind === "audio" ? "audio" : "video")}`}
          media={editingTranscript.kind}
          initialTranscript={editingTranscript.transcript}
          busy={dialogBusy}
          error={dialogError}
          submitLabel="Lưu transcript"
          onSubmit={(v) => void saveTranscript(v)}
          onCancel={() => setEditingTranscript(null)}
        />
      )}
    </form>
  );
}
