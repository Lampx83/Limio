"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";

export default function MarkResolvedButton({
  threadId,
  postId,
}: {
  threadId: string;
  postId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    const res = await fetch(apiUrl(`/api/forum-threads/${threadId}/resolve`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Đã đánh dấu câu trả lời");
      router.refresh();
    } else {
      toast.error("Không lưu được, vui lòng thử lại");
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      title="Chọn câu này là câu trả lời chính thức cho thread của bạn"
      aria-label="Đánh dấu câu trả lời được chấp nhận"
      className="inline-flex items-center gap-1 rounded-md border border-success-300 bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700 hover:bg-success-100 disabled:opacity-50"
    >
      <span aria-hidden>✓</span>
      {busy ? "Đang lưu..." : "Đánh dấu là câu trả lời"}
    </button>
  );
}
