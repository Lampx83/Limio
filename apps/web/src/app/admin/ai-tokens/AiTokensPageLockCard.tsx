"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";

export default function AiTokensPageLockCard({ initialLocked }: { initialLocked: boolean }) {
  const router = useRouter();
  const [locked, setLocked] = useState(initialLocked);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !locked;
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/admin/settings"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "ai.tokens_page.locked": next ? "true" : "false" }),
      });
      if (!res.ok) {
        toast.error("Không đổi được trạng thái trang Token AI");
        return;
      }
      setLocked(next);
      toast.success(next ? "Đã khoá trang Token AI" : "Đã mở lại trang Token AI");
      router.refresh();
    } catch {
      toast.error("Lỗi mạng, thử lại nhé");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`mt-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${
        locked ? "banner-warning" : "banner-success"
      }`}
    >
      {locked ? <Lock className="h-5 w-5 shrink-0" aria-hidden /> : <LockOpen className="h-5 w-5 shrink-0" aria-hidden />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {locked ? "Trang Token AI của người dùng đang bị khoá" : "Trang Token AI của người dùng đang mở"}
        </p>
        <p className="text-xs">
          {locked
            ? "Người học và giảng viên không thấy mục Token AI, mở /me/ai-tokens sẽ ra 404. Trang đối soát này vẫn dùng bình thường."
            : "Người học và giảng viên thấy mục Token AI trong menu và mua được thêm lượt."}
        </p>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`${locked ? "btn-primary" : "btn-secondary"} btn-sm inline-flex items-center gap-1.5`}
      >
        {locked ? <LockOpen className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
        {busy ? "Đang lưu…" : locked ? "Mở lại trang" : "Khoá trang"}
      </button>
    </div>
  );
}
