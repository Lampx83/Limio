"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

/**
 * Nút Lưu / Đã lưu của thẻ giáo trình. Cập nhật ngay (lạc quan); hỏng thì hoàn lại và báo. Gọi API chỉ để ghi
 * nhớ, không chặn thao tác nào khác của học viên.
 */
export default function LibrarySaveButton({ courseId, initialSaved }: { courseId: string; initialSaved: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    if (busy) return;
    const next = !saved;
    setSaved(next);
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(apiUrl("/api/library/saves"), {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setSaved(!next);
      setErr("Chưa lưu được, hãy thử lại.");
    } finally {
      setBusy(false);
    }
  }

  const Icon = saved ? BookmarkCheck : Bookmark;
  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={saved}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
          saved
            ? "border-lime-300 bg-lime-50 text-lime-800"
            : "border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200"
        }`}
      >
        <Icon size={15} aria-hidden />
        {saved ? "Đã lưu" : "Lưu"}
      </button>
      {err && (
        <span role="alert" className="text-caption mt-1 text-danger-600">
          {err}
        </span>
      )}
    </span>
  );
}
