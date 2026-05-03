"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PublishControls({
  courseId,
  status,
  untaggedLessons,
}: {
  courseId: string;
  status: string;
  untaggedLessons: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/courses/${courseId}/publish`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "publish_failed");
    }
  }

  async function archive() {
    if (!confirm("Archive course này? Không thể publish lại.")) return;
    setBusy(true);
    const res = await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  if (status === "archived") {
    return <span className="text-xs text-slate-500">Đã archived</span>;
  }

  if (status === "published") {
    return (
      <button
        onClick={archive}
        disabled={busy}
        className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
      >
        Archive
      </button>
    );
  }

  const blocked = untaggedLessons.length > 0;
  return (
    <div className="text-right">
      <button
        onClick={publish}
        disabled={busy || blocked}
        title={
          blocked
            ? `${untaggedLessons.length} lesson chưa tag skill: ${untaggedLessons
                .map((l) => l.title)
                .join(", ")}`
            : ""
        }
        className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Publishing..." : "Publish"}
      </button>
      {blocked && (
        <p className="mt-1 max-w-xs text-xs text-amber-700 dark:text-amber-300">
          {untaggedLessons.length} lesson cần tag skill trước khi publish
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">Lỗi: {error}</p>}
    </div>
  );
}
