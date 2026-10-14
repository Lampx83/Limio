"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";

export default function SetDefaultRoomButton({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/exam-rooms/${roomId}/set-default`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={onClick}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
        title="Thí sinh không nhập mã phòng sẽ được gán vào phòng này"
      >
        <Star className="h-3.5 w-3.5" />
        {busy ? "Đang cập nhật…" : "Đặt làm phòng mặc định"}
      </button>
      {err && <span className="text-xs text-red-700">Lỗi: {err}</span>}
    </div>
  );
}
