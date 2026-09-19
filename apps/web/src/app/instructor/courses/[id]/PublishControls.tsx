"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

export default function PublishControls({
  courseId,
  status,
  untaggedLessons,
  personalizationEnabled,
}: {
  courseId: string;
  status: string;
  untaggedLessons: Array<{ id: string; title: string }>;
  personalizationEnabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    setBusy(true);
    setError(null);
    const res = await fetch(apiUrl(`/api/courses/${courseId}/publish`), { method: "POST" });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "publish_failed");
    }
  }

  if (status === "archived") {
    return <span className="chip">Đã archived</span>;
  }

  // Khoá đã publish: nút Archive nằm ở "Hành động khóa" (tab Tổng quan) — hành
  // động không hoàn tác thì không đặt ngay trên đầu trang.
  if (status === "published") return null;

  const blocked = personalizationEnabled && untaggedLessons.length > 0;
  return (
    <div className="flex items-center gap-2">
      {blocked && (
        <span
          className="chip-accent text-xs"
          title={`Lesson chưa tag: ${untaggedLessons.map((l) => l.title).join(", ")}`}
        >
          ⚠ {untaggedLessons.length} chưa tag skill
        </span>
      )}
      {error && (
        <span className="text-xs text-danger-600" title={error}>
          Lỗi
        </span>
      )}
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
    </div>
  );
}
