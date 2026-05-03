"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function AssignmentEditor({
  assignmentId,
  moduleId,
  minWords,
}: {
  assignmentId: number;
  moduleId: number;
  minWords: number;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startRef = useRef<number>(Date.now());
  const editsRef = useRef<number>(0);
  const pasteRef = useRef<number>(0);
  const focusedRef = useRef<boolean>(true);
  const lastFocusEvtRef = useRef<number>(Date.now());

  // Đếm từ tiếng Việt: tách theo whitespace
  const wordCount = content.trim() === "" ? 0 : content.trim().split(/\s+/).length;
  const meetsMin = wordCount >= minWords;

  // Log open
  useEffect(() => {
    fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "assignment_open",
        assignment_id: assignmentId,
      }),
    });
    function onFocus() {
      focusedRef.current = true;
      lastFocusEvtRef.current = Date.now();
      fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "assignment_focus",
          assignment_id: assignmentId,
        }),
      });
    }
    function onBlur() {
      focusedRef.current = false;
      const focusedFor = Date.now() - lastFocusEvtRef.current;
      fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "assignment_blur",
          assignment_id: assignmentId,
          payload: { focused_ms: focusedFor },
        }),
      });
    }
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    editsRef.current += 1;
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    pasteRef.current += 1;
    const text = e.clipboardData.getData("text") ?? "";
    fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "assignment_paste",
        assignment_id: assignmentId,
        payload: { length: text.length },
      }),
    });
  }

  async function submit() {
    setError(null);
    if (!meetsMin) {
      setError(`Bài tối thiểu ${minWords} từ.`);
      return;
    }
    setSubmitting(true);
    try {
      const elapsed = Math.round((Date.now() - startRef.current) / 1000);
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignment_id: assignmentId,
          content,
          time_spent_sec: elapsed,
          edit_count: editsRef.current,
          paste_count: pasteRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Nộp bài thất bại");
        return;
      }
      router.push(`/student/feedback/${data.submission_id}`);
    } catch {
      setError("Lỗi mạng, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card p-6">
      <h2 className="font-semibold text-lg mb-3">Bài làm của bạn</h2>
      <textarea
        className="w-full min-h-[300px] rounded border border-slate-300 p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        value={content}
        onChange={onChange}
        onPaste={onPaste}
        placeholder="Viết bài của bạn ở đây..."
        spellCheck={false}
      />
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className={meetsMin ? "text-emerald-600" : "text-slate-500"}>
          {wordCount} từ {meetsMin ? "✓" : `(cần ≥ ${minWords})`}
        </span>
        <span className="text-slate-400 text-xs">
          Hệ thống ghi lại thời gian, số lần chỉnh sửa và paste — phục vụ nghiên cứu.
        </span>
      </div>
      {error && (
        <div className="mt-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded p-2">
          {error}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={() => router.push(`/student/modules/${moduleId}`)}
          className="btn-secondary"
          type="button"
        >
          Lưu nháp & quay lại
        </button>
        <button
          onClick={submit}
          disabled={!meetsMin || submitting}
          className="btn-primary disabled:opacity-50"
        >
          {submitting ? "Đang sinh phản hồi..." : "Nộp bài & nhận phản hồi AI"}
        </button>
      </div>
    </div>
  );
}
