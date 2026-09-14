"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

/** Xoá một lượt vấn đáp — dọn dữ liệu test, hoặc mở lại lượt cho SV làm lại. */
export default function DeleteOralAttemptButton({
  attemptId,
  studentLabel,
}: {
  attemptId: string;
  studentLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm(`Xoá lượt vấn đáp của "${studentLabel}"? Không thể hoàn tác.`)) return;
    setBusy(true);
    const res = await fetch(apiUrl(`/api/exam-attempts/${attemptId}`), { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
    else alert("Không xoá được lượt thi này.");
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded border border-red-200 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
      title="Xoá lượt vấn đáp"
    >
      <Trash2 className="h-3 w-3" />
      {busy ? "…" : "Xoá"}
    </button>
  );
}
