"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

export default function NewQuestionSetPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onCreate = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(apiUrl("/api/gameshow/question-sets"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!r.ok) {
        setErr(`HTTP ${r.status}`);
        return;
      }
      const j = (await r.json()) as { id: string };
      router.push(`/instructor/gameshow/question-sets/${j.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold">📝 Bộ câu hỏi mới</h1>
      <p className="mt-1 text-sm text-faint">Đặt tên trước, thêm câu hỏi ở bước sau.</p>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        placeholder="Vd: Ôn tập chương 1 — Đại số"
        className="mt-6 w-full rounded border border-default px-3 py-2.5 text-sm"
        autoFocus
      />

      {err && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          ⚠ {err}
        </div>
      )}

      <button
        onClick={onCreate}
        disabled={busy || !title.trim()}
        className="mt-4 rounded bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Đang tạo..." : "Tạo & Soạn câu hỏi →"}
      </button>
    </main>
  );
}
