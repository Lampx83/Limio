"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CloneButton({ examId }: { examId: string }) {
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
      // Send instructor to the new draft. Need courseId from URL.
      const courseId = window.location.pathname.split("/")[3];
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
        {busy ? "..." : "📋 Clone"}
      </button>
      {err && <span className="text-xs text-red-700">⚠ {err}</span>}
    </>
  );
}
