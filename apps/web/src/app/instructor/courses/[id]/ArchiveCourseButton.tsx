"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

export default function ArchiveCourseButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function archive() {
    if (!confirm("Archive course này? Không thể publish lại.")) return;
    setBusy(true);
    const res = await fetch(apiUrl(`/api/courses/${courseId}`), { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(`Archive thất bại: ${d.error ?? "unknown"}`);
    }
  }

  return (
    <button
      onClick={archive}
      disabled={busy}
      className="btn-secondary btn-sm text-danger-600"
      title="Lưu trữ khoá học — không thể publish lại"
    >
      {busy ? "..." : "Archive"}
    </button>
  );
}
