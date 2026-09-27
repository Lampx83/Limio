"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { lmsErrorMessage } from "@/lib/lmsErrors";

export default function PublishControls({
  courseId,
  status,
}: {
  courseId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    setBusy(true);
    setError(null);
    let res: Response;
    try {
      res = await fetch(apiUrl(`/api/courses/${courseId}/publish`), { method: "POST" });
    } catch {
      setBusy(false);
      setError(lmsErrorMessage("network_error"));
      return;
    }
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(lmsErrorMessage(d.error ?? "publish_failed", res.status));
    }
  }

  if (status === "archived") {
    return <span className="chip">Đã archived</span>;
  }

  // Khoá đã publish: nút Archive nằm ở "Hành động khóa" (tab Tổng quan) — hành
  // động không hoàn tác thì không đặt ngay trên đầu trang.
  if (status === "published") return null;

  // Không khoá nút vì thiếu chủ đề: publishCourse tự gắn chủ đề cho các bài còn
  // thiếu trước khi kiểm tra (xem courses.ts).
  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="max-w-xs text-xs text-danger-600" role="alert">
          {error}
        </span>
      )}
      <button
        onClick={publish}
        disabled={busy}
        className="btn-sm inline-flex items-center justify-center gap-2 rounded-lg bg-success-600 px-3 py-1.5 font-medium text-white transition-all hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Publishing..." : "Publish"}
      </button>
    </div>
  );
}
