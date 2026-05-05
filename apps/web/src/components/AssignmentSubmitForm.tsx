"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(apiUrl(`/api/assignments/${assignmentId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body,
        attachmentUrl: attachmentUrl.trim() || null,
      }),
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Đã nộp bài", {
        description: "Chờ instructor chấm điểm.",
      });
      setBody("");
      setAttachmentUrl("");
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
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        rows={6}
        placeholder="Nội dung bài làm..."
        className="textarea"
      />
      <input
        value={attachmentUrl}
        onChange={(e) => setAttachmentUrl(e.target.value)}
        type="url"
        placeholder="URL đính kèm (Google Drive, GitHub...) — optional"
        className="input text-xs"
      />
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
