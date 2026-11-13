"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";

export default function MarkResolvedButton({
  threadId,
  postId,
}: {
  threadId: string;
  postId: string;
}) {
  const router = useRouter();
  const t = useT();
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
      toast.success(t("learn.thread.resolvedMarked"));
      router.refresh();
    } else {
      toast.error(t("learn.thread.saveFailed"));
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={t("learn.thread.markTitle")}
      aria-label={t("learn.thread.markAria")}
      className="inline-flex items-center gap-1 rounded-md border border-success-300 bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700 hover:bg-success-100 disabled:opacity-50"
    >
      <span aria-hidden>✓</span>
      {busy ? t("learn.thread.saving") : t("learn.thread.markButton")}
    </button>
  );
}
