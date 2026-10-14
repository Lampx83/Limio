"use client";

/**
 * "Phần việc của tôi" trên bài nộp nhóm (docs/group-submission-AC.md C6).
 * Mỗi thành viên tự ghi phần mình làm; lưu ô này KHÔNG đưa bài về chưa chấm.
 */
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";

const MAX_CHARS = 1000;

export default function ContributionNoteEditor({
  submissionId,
  initialNote,
}: {
  submissionId: string;
  initialNote: string | null;
}) {
  const [saved, setSaved] = useState(initialNote ?? "");
  const [note, setNote] = useState(initialNote ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = note.trim() !== saved.trim();
  const tooLong = note.length > MAX_CHARS;

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (tooLong || !dirty) return;
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/submissions/${submissionId}/contribution`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (res.ok) {
        setSaved(note.trim());
        setNote(note.trim());
        toast.success("Đã lưu phần việc của bạn");
      } else {
        toast.error("Chưa lưu được", { description: "Bạn thử lại sau ít phút nhé." });
      }
    } catch {
      toast.error("Chưa lưu được", { description: "Không kết nối được máy chủ." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSave} className="rounded-lg border border-token p-3">
      <label htmlFor={`contribution-${submissionId}`} className="label">
        Phần việc của tôi
      </label>
      <p className="text-caption mt-0.5">
        Ghi ngắn những gì bạn đã làm cho bài nhóm. Giảng viên đọc khi chấm. Lưu ô này không làm bài về
        chưa chấm.
      </p>
      <textarea
        id={`contribution-${submissionId}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="Ví dụ: phỏng vấn 2 người dùng, vẽ luồng đặt lịch, làm bản mẫu trang chủ."
        className="textarea mt-2 text-sm"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className={`text-xs tabular-nums ${tooLong ? "text-danger-600" : "text-faint"}`}>
          {note.length.toLocaleString("vi-VN")}/{MAX_CHARS.toLocaleString("vi-VN")} ký tự
        </span>
        <button type="submit" disabled={busy || !dirty || tooLong} className="btn-secondary btn-sm">
          {busy ? "Đang lưu…" : "Lưu"}
        </button>
      </div>
    </form>
  );
}
