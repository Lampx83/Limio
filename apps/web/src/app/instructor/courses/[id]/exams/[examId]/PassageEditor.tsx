"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Editor } from "@tiptap/react";
import dynamic from "next/dynamic";
import { Music, Video } from "lucide-react";
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
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

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
      form.append("file", file);
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

  function onInsertVideo() {
    const url = window.prompt(
      "Dán URL video. Hỗ trợ: YouTube, Vimeo, Google Drive (link chia sẻ), OneDrive (link Embed), hoặc file .mp4/.webm trực tiếp.\n\nLưu ý: Google Drive cần đặt quyền 'Anyone with the link'. OneDrive nên dùng link Embed (Share → Embed).",
      "",
    );
    if (url === null) return;
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      window.alert("URL không được để trống.");
      return;
    }
    try {
      const u = new URL(trimmedUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
    } catch {
      window.alert("URL không hợp lệ (chỉ chấp nhận http/https).");
      return;
    }
    const alt = window.prompt(
      "Mô tả video (alt text) — bắt buộc cho accessibility:",
      "",
    );
    if (alt === null) return;
    const trimmed = alt.trim();
    if (!trimmed) {
      window.alert("Alt text không được để trống.");
      return;
    }
    insertMedia("video", trimmedUrl, trimmed);
  }

  /** Bài luyện: tải tệp video từ máy lên (dùng kho video của bài học: MP4, WebM, MOV, MKV, OGV, tối đa 500 MB). */
  async function onUploadVideo(file: File) {
    const alt = window.prompt("Mô tả nội dung video (alt text) — bắt buộc cho accessibility:", "");
    if (alt === null) return;
    const trimmed = alt.trim();
    if (!trimmed) {
      window.alert("Alt text không được để trống.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(apiUrl("/api/lesson-media/videos"), { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        window.alert(`Tải video lỗi: ${data.error ?? res.status}`);
        return;
      }
      insertMedia("video", data.url, trimmed);
    } finally {
      setUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  }

  /** Tải audio lên (hỏi mô tả và transcript tuỳ chọn) rồi chèn khối audio tại con trỏ. */
  async function onUploadAudio(file: File) {
    const alt = window.prompt("Mô tả nội dung audio (alt text) — bắt buộc cho accessibility:", "");
    if (alt === null) return;
    const trimmed = alt.trim();
    if (!trimmed) {
      window.alert("Alt text không được để trống.");
      return;
    }
    const transcript = window.prompt("Transcript (tuỳ chọn) — khuyến nghị cho audio nghe 1 lần:", "");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("altText", trimmed);
      if (transcript && transcript.trim().length > 0) form.append("transcript", transcript.trim());
      const res = await fetch(apiUrl(`/api/exams/${examId}/assets`), { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(`Upload lỗi: ${data?.error ?? res.status}`);
        return;
      }
      insertMedia("audio", data.url as string, trimmed);
    } finally {
      setUploading(false);
      if (audioInputRef.current) audioInputRef.current.value = "";
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
              onClick={() => audioInputRef.current?.click()}
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
              <Video className="mr-1 inline h-3.5 w-3.5 align-text-bottom" /> {practiceMode ? "Dán link video" : "Chèn video"}
            </button>
            {practiceMode && (
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                disabled={uploading || readOnlyContent}
                className="rounded border border-default px-2 py-0.5 text-xs hover:bg-white disabled:opacity-50"
              >
                <Video className="mr-1 inline h-3.5 w-3.5 align-text-bottom" /> Tải video lên
              </button>
            )}
          </div>
          {practiceMode && (
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-matroska,.mp4,.webm,.ogv,.mov,.mkv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUploadVideo(f);
              }}
            />
          )}
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/mp4"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUploadAudio(f);
            }}
          />
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
    </form>
  );
}
