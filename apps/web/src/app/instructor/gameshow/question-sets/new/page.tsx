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
    <main className="w-full py-4">
      <h1 className="text-2xl font-bold">Bộ câu hỏi mới</h1>
      <p className="text-meta mt-1.5">Đặt tên trước, thêm câu hỏi ở bước sau.</p>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        placeholder="Vd: Ôn tập chương 1 — Đại số"
        className="input mt-8 py-2.5"
        autoFocus
      />

      {err && (
        <div className="banner-danger mt-3">
          {err}
        </div>
      )}

      <button
        onClick={onCreate}
        disabled={busy || !title.trim()}
        className="btn-primary mt-4"
      >
        {busy ? "Đang tạo..." : "Tạo & soạn câu hỏi"}
      </button>
    </main>
  );
}
