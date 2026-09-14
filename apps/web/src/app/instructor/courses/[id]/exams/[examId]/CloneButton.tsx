"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Copy } from "lucide-react";

export default function CloneButton({
  examId,
  courseId,
}: {
  examId: string;
  courseId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onClick = async () => {
    if (
      !window.confirm(
        "Clone bài thi này (tạo bản nháp mới với cùng nội dung)?",
      )
    )
      return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/exams/${examId}/clone`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      const j = (await r.json()) as { examId: string };
      router.push(`/instructor/courses/${courseId}/exams/${j.examId}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        data-testid="clone-exam-btn"
        onClick={onClick}
        disabled={busy}
        className="rounded border border-default bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? "..." : <span className="inline-flex items-center gap-1.5"><Copy className="h-3.5 w-3.5" /> Clone</span>}
      </button>
      {err && <span className="inline-flex items-center gap-1 text-xs text-red-700"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {err}</span>}
    </>
  );
}
