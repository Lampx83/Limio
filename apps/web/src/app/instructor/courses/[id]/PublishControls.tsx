"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

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
    const res = await fetch(apiUrl(`/api/courses/${courseId}/publish`, { method: "POST" });
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
    const res = await fetch(apiUrl(`/api/courses/${courseId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  if (status === "archived") {
    return <span className="chip">Đã archived</span>;
  }

  if (status === "published") {
    return (
      <button
        onClick={archive}
        disabled={busy}
        className="btn-sm inline-flex items-center justify-center gap-2 rounded-lg border border-danger-100 bg-[rgb(var(--surface))] px-3 py-1.5 font-medium text-danger-600 transition-colors hover:bg-danger-50 disabled:opacity-50"
      >
        Archive
      </button>
    );
  }

  const blocked = untaggedLessons.length > 0;
  return (
    <div className="flex flex-col items-end gap-1">
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
        className="btn-sm inline-flex items-center justify-center gap-2 rounded-lg bg-success-600 px-3 py-1.5 font-medium text-white transition-all hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Publishing..." : "Publish"}
      </button>
      {blocked && (
        <p className="max-w-xs text-right text-xs text-accent-700">
          {untaggedLessons.length} lesson cần tag skill trước khi publish
        </p>
      )}
      {error && <p className="text-xs text-danger-600">Lỗi: {error}</p>}
    </div>
  );
}
