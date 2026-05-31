"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";

export default function LeaderboardOptOutToggle({
  initialOptedOut,
}: {
  initialOptedOut: boolean;
}) {
  const router = useRouter();
  const [optedOut, setOptedOut] = useState(initialOptedOut);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    if (saving) return;
    const next = !optedOut;
    setSaving(true);
    setOptedOut(next); // optimistic
    try {
      const res = await fetch(apiUrl("/api/me/leaderboard-opt-out"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optOut: next }),
      });
      if (!res.ok) throw new Error("request_failed");
      toast.success(next ? "Đã ẩn bạn khỏi bảng xếp hạng" : "Bạn đã hiện trên bảng xếp hạng");
      router.refresh();
    } catch {
      setOptedOut(!next); // rollback
      toast.error("Không cập nhật được", { description: "Vui lòng thử lại." });
    } finally {
      setSaving(false);
    }
  }

  if (optedOut) {
    return (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-token bg-[rgb(var(--surface-muted))] p-4 text-sm">
        <span className="text-muted">🙈 Bạn đang ẩn khỏi bảng xếp hạng.</span>
        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          className="btn-secondary text-sm disabled:opacity-60"
        >
          {saving ? "Đang lưu…" : "Hiện tôi lên"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
      <span>👁 Bạn đang hiện trên bảng xếp hạng.</span>
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        className="link disabled:opacity-60"
      >
        {saving ? "Đang lưu…" : "Ẩn tôi đi"}
      </button>
    </div>
  );
}
