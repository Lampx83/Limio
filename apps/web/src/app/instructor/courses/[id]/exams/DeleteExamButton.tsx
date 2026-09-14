"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

export default function DeleteExamButton({
  examId,
  hasAttempts,
}: {
  examId: string;
  hasAttempts: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hasAttempts) return null;

  async function remove() {
    if (!window.confirm("Xoá bài thi này? Hành động không thể hoàn tác.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(apiUrl(`/api/exams/${examId}`), { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data?.error === "string" ? data.error : "delete_failed");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" /> {busy ? "Đang xoá…" : "Xoá"}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </>
  );
}
