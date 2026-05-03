"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AssignmentSubmitForm({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/assignments/${assignmentId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body,
        attachmentUrl: attachmentUrl.trim() || null,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setBody("");
      setAttachmentUrl("");
      setOpen(false);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "submit_failed");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
      >
        ✏️ Nộp bài / sửa bài đã nộp
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2 text-sm">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        rows={6}
        placeholder="Nội dung bài làm..."
        className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
      />
      <input
        value={attachmentUrl}
        onChange={(e) => setAttachmentUrl(e.target.value)}
        type="url"
        placeholder="URL đính kèm (Google Drive, Github...) — optional"
        className="w-full rounded border border-slate-300 px-2 py-1 text-xs dark:bg-slate-900 dark:border-slate-700"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {busy ? "..." : "Nộp bài"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700"
        >
          Hủy
        </button>
        {error && <span className="text-xs text-red-600">Lỗi: {error}</span>}
      </div>
      <p className="text-xs text-slate-500">
        Nộp lại sẽ ghi đè bài cũ và trở về trạng thái "chưa chấm".
      </p>
    </form>
  );
}
