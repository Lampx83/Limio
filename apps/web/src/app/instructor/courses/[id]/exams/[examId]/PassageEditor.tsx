"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";
import SkillPicker from "./SkillPicker";
import { plainTextToTiptap, tiptapToPlainText } from "./contentHelpers";

interface Skill {
  id: string;
  code: string;
  name: string;
}

interface PassageInput {
  title: string;
  content: string;
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
}

const EMPTY: PassageInput = {
  title: "",
  content: "",
  audioPolicy: "free_replay",
  maxAudioPlays: 2,
  revealMode: "all_at_once",
  skills: [],
};

export default function PassageEditor({ mode, examId, passageId, initial, onClose }: Props) {
  const router = useRouter();
  const [v, setV] = useState<PassageInput>(() =>
    initial
      ? {
          title: initial.title,
          content: tiptapToPlainText(initial.contentJson),
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
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  async function onUploadFile(file: File, kind: "image" | "audio") {
    const promptLabel =
      kind === "image"
        ? "Mô tả ảnh (alt text) — bắt buộc cho accessibility:"
        : "Mô tả nội dung audio (alt text) — bắt buộc cho accessibility:";
    const alt = window.prompt(promptLabel, "");
    if (alt === null) return;
    const trimmed = alt.trim();
    if (!trimmed) {
      window.alert("Alt text không được để trống.");
      return;
    }
    let transcript: string | null = null;
    if (kind === "audio") {
      transcript = window.prompt(
        "Transcript (tuỳ chọn) — khuyến nghị cho audio nghe 1 lần:",
        "",
      );
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("altText", trimmed);
      if (transcript && transcript.trim().length > 0) {
        form.append("transcript", transcript.trim());
      }
      const res = await fetch(apiUrl(`/api/exams/${examId}/assets`), {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(`Upload lỗi: ${data?.error ?? res.status}`);
        return;
      }
      const md =
        kind === "image"
          ? `![${trimmed}](${data.url})`
          : `[[audio:${data.url}|${trimmed}]]`;
      const ta = contentRef.current;
      const before = v.content;
      const start = ta?.selectionStart ?? before.length;
      const end = ta?.selectionEnd ?? before.length;
      const sep = before.length === 0 ? "" : "\n\n";
      const inserted =
        before.slice(0, start) +
        (start === 0 ? "" : sep) +
        md +
        (end < before.length ? sep : "") +
        before.slice(end);
      setV({ ...v, content: inserted });
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
      if (audioInputRef.current) audioInputRef.current.value = "";
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {
      title: v.title,
      contentJson: plainTextToTiptap(v.content),
      audioPolicy: v.audioPolicy,
      revealMode: v.revealMode,
      skillIds: v.skills.map((s) => s.id),
    };
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
          <label className="block text-sm font-medium">
            Nội dung (mỗi dòng trống = đoạn mới; ảnh dùng cú pháp{" "}
            <code className="text-xs">![alt](url)</code>)
          </label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading}
              className="rounded border border-default px-2 py-0.5 text-xs hover:bg-white disabled:opacity-50"
            >
              {uploading ? "Đang tải…" : "📷 Tải ảnh"}
            </button>
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              disabled={uploading}
              className="rounded border border-default px-2 py-0.5 text-xs hover:bg-white disabled:opacity-50"
            >
              🎵 Tải audio
            </button>
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadFile(f, "image");
            }}
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/mp4"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadFile(f, "audio");
            }}
          />
        </div>
        <textarea
          ref={contentRef}
          rows={8}
          value={v.content}
          onChange={(e) => setV({ ...v, content: e.target.value })}
          placeholder="Dán nội dung bài đọc ở đây. Cách 1 dòng trắng giữa các đoạn."
          className="mt-1 w-full rounded border border-default px-3 py-2 text-sm font-mono"
        />
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
      </div>

      <div>
        <span className="block text-sm font-medium">Skill liên quan</span>
        <div className="mt-1">
          <SkillPicker value={v.skills} onChange={(s) => setV({ ...v, skills: s })} />
        </div>
      </div>

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
          className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Đang lưu…" : mode === "create" ? "Thêm đoạn" : "Lưu"}
        </button>
      </div>
    </form>
  );
}
