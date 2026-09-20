"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

export default function AddQuizForm({
  lessonId,
  embedded = false,
  onCancel,
}: {
  lessonId: string;
  embedded?: boolean;
  /** Đóng modal sau khi tạo xong (không còn nút Hủy). */
  onCancel?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(embedded);
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [requireConfidence, setRequireConfidence] = useState(false);
  const [busy, setBusy] = useState(false);

  function close() {
    if (embedded) onCancel?.();
    else setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-token bg-[rgb(var(--surface))] py-2 text-sm font-medium text-muted transition-colors hover:border-brand-300 hover:bg-brand-soft hover:text-brand-700"
      >
        + Thêm quiz
      </button>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(apiUrl(`/api/lessons/${lessonId}/quizzes`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        difficulty,
        requireConfidence,
      }),
    });
    if (res.ok) {
      const { quizId } = (await res.json()) as { quizId: string };
      setTitle("");
      close();
      // Sang thẳng trang soạn quiz để nhập câu hỏi.
      router.push(`${pathname}/quizzes/${quizId}/edit`);
    }
    setBusy(false);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-3"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        placeholder="Tên quiz"
        autoFocus
        className="input"
      />
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-2">
          <span className="text-muted">Difficulty (1-5)</span>
          <input
            type="number"
            min={1}
            max={5}
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
            className="input w-16"
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={requireConfidence}
            onChange={(e) => setRequireConfidence(e.target.checked)}
            className="h-4 w-4 rounded border-token accent-brand-600"
          />
          <span>Yêu cầu confidence</span>
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "..." : "Tạo quiz"}
        </button>
      </div>
    </form>
  );
}
