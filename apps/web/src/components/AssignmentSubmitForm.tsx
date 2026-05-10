"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";
import {
  GENERATIVE_PRESETS,
  acceptForFormat,
  requiresUpload,
  type GenerativeActivityType,
  type ResponseFormat,
} from "@/lib/generativeActivity";

const REFLECTION_MIN_CHARS = 20;

export default function AssignmentSubmitForm({
  assignmentId,
  pedagogicalIntent = null,
  responseFormat = "text",
  requireSelfRating = false,
  requireReflection = false,
}: {
  assignmentId: string;
  pedagogicalIntent?: GenerativeActivityType | null;
  responseFormat?: ResponseFormat;
  requireSelfRating?: boolean;
  requireReflection?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [selfRating, setSelfRating] = useState<number | "">("");
  const [reflection, setReflection] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const needUpload = requiresUpload(responseFormat);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch(
        apiUrl(`/api/assignments/submissions/upload`),
        { method: "POST", body: fd },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error("Tải lên thất bại", {
          description: d.error ?? "Vui lòng thử lại.",
        });
      } else {
        const d = (await res.json()) as { url: string };
        const absolute = new URL(d.url, window.location.origin).toString();
        setAttachmentUrl(absolute);
        toast.success("Đã tải file lên");
      }
    } finally {
      setUploading(false);
    }
  }

  const promptHint = pedagogicalIntent
    ? GENERATIVE_PRESETS[pedagogicalIntent].promptTemplate
    : null;

  function reset() {
    setBody("");
    setAttachmentUrl("");
    setSelfRating("");
    setReflection("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (requireSelfRating && selfRating === "") {
      toast.error("Hãy chọn mức tự đánh giá trước khi nộp.");
      return;
    }
    if (requireReflection && reflection.trim().length < REFLECTION_MIN_CHARS) {
      toast.error(
        `Reflection cần ít nhất ${REFLECTION_MIN_CHARS} ký tự để giúp bạn ghi nhớ tốt hơn.`,
      );
      return;
    }
    if (needUpload && !attachmentUrl.trim()) {
      toast.error("Hoạt động này cần tải lên file hoặc dán URL.");
      return;
    }
    setBusy(true);
    const payload: Record<string, unknown> = {
      body,
      attachmentUrl: attachmentUrl.trim() || null,
    };
    if (selfRating !== "") payload.selfRating = Number(selfRating);
    if (reflection.trim()) payload.reflection = reflection.trim();

    const res = await fetch(apiUrl(`/api/assignments/${assignmentId}/submit`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Đã nộp bài", {
        description: pedagogicalIntent
          ? "Phản hồi sẽ được tổng hợp dần."
          : "Chờ instructor chấm điểm.",
      });
      reset();
      setOpen(false);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error("Nộp bài thất bại", {
        description: d.error ?? "Vui lòng thử lại.",
      });
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary btn-sm">
        Nộp bài / sửa bài đã nộp
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-3"
    >
      {promptHint && (
        <p className="rounded-lg border border-brand-200 bg-brand-soft p-2 text-xs text-brand-700">
          💡 {promptHint}
        </p>
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        rows={6}
        placeholder="Nội dung bài làm..."
        className="textarea"
      />
      {needUpload && (
        <div className="space-y-1 rounded-lg border border-token bg-[rgb(var(--surface))] p-2">
          <span className="text-xs font-medium text-default">
            Tải lên artifact ({responseFormat})
            <span className="text-danger-600"> *</span>
          </span>
          <input
            type="file"
            accept={acceptForFormat(responseFormat)}
            onChange={onPickFile}
            disabled={uploading}
            className="block w-full text-xs"
          />
          {attachmentUrl && (
            <p className="text-xs text-success-700">
              ✓ Đã tải:{" "}
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noopener"
                className="link"
              >
                xem file
              </a>
            </p>
          )}
        </div>
      )}
      <input
        value={attachmentUrl}
        onChange={(e) => setAttachmentUrl(e.target.value)}
        type="url"
        placeholder={
          needUpload
            ? "Hoặc dán URL ngoài (Miro, YouTube, Google Drive...)"
            : "URL đính kèm (Google Drive, GitHub...) — optional"
        }
        className="input text-xs"
      />

      {(requireSelfRating || requireReflection) && (
        <div className="space-y-2 rounded-lg border border-token bg-[rgb(var(--surface))] p-3">
          {requireSelfRating && (
            <label className="block">
              <span className="text-xs font-medium text-default">
                Bạn tự đánh giá mức độ hiểu bài này như thế nào?
                <span className="text-danger-600"> *</span>
              </span>
              <div className="mt-1 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSelfRating(n)}
                    className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm font-semibold transition-colors ${
                      selfRating === n
                        ? "border-brand-500 bg-brand-soft text-brand-700"
                        : "border-token bg-[rgb(var(--surface-muted))] text-muted hover:border-brand-300"
                    }`}
                    aria-pressed={selfRating === n}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <span className="mt-1 block text-xs text-faint">
                1 = chưa hiểu, 5 = hiểu rất rõ và có thể dạy lại.
              </span>
            </label>
          )}
          {requireReflection && (
            <label className="block">
              <span className="text-xs font-medium text-default">
                Bạn học được gì từ bài này? Còn điểm nào chưa rõ?
                <span className="text-danger-600"> *</span>
              </span>
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                rows={3}
                minLength={REFLECTION_MIN_CHARS}
                placeholder="Viết tối thiểu 20 ký tự..."
                className="textarea mt-1 text-sm"
              />
              <span className="mt-1 block text-xs text-faint">
                {reflection.trim().length}/{REFLECTION_MIN_CHARS} ký tự
              </span>
            </label>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "..." : "Nộp bài"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-secondary btn-sm"
        >
          Hủy
        </button>
      </div>
      <p className="text-xs text-faint">
        Nộp lại sẽ ghi đè bài cũ và trở về trạng thái &ldquo;chưa chấm&rdquo;.
      </p>
    </form>
  );
}
