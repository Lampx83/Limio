"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Share2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

interface ShareResult {
  code: string;
  path: string;
  published: boolean;
  reusedExistingCode: boolean;
}

/**
 * "Phát link" — một nút thay cho chuỗi publish → đổi chế độ truy cập → sinh mã
 * → (tạo đợt → tạo ca → tạo phòng) → copy link.
 *
 * Cấu trúc đợt/ca/phòng vẫn được dựng đủ bên dưới, giáo viên chỉ không phải
 * học nó.
 */
export default function ShareLinkButton({
  examId,
  questionCount,
  existingCode,
}: {
  examId: string;
  questionCount: number;
  existingCode: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ShareResult | null>(
    existingCode
      ? { code: existingCode, path: `/exam/${existingCode}`, published: false, reusedExistingCode: true }
      : null,
  );
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(apiUrl(`/api/exams/${examId}/share`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ timingMode: "manual" }),
      });
      const j = (await r.json().catch(() => null)) as
        | (ShareResult & { error?: string; details?: { message?: string } })
        | null;
      if (!r.ok) {
        setErr(j?.details?.message ?? j?.error ?? `HTTP ${r.status}`);
        return;
      }
      setResult(j as ShareResult);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const fullUrl =
    result && typeof window !== "undefined"
      ? `${window.location.origin}${result.path}`
      : result?.path ?? "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Trình duyệt chặn clipboard — link vẫn hiện để chọn tay.
    }
  };

  if (!result) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={share}
          disabled={busy || questionCount === 0}
          title={
            questionCount === 0 ? "Thêm ít nhất một câu hỏi trước" : undefined
          }
          className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Share2 className="h-4 w-4 shrink-0" />
          {busy ? "Đang phát…" : "Phát link"}
        </button>
        {err && <span className="text-caption text-red-700">{err}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5 rounded border border-emerald-300 bg-emerald-50 px-2 py-1">
        <span className="font-mono text-sm font-semibold tracking-wider text-emerald-900">
          {result.code}
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded p-1 text-emerald-800 hover:bg-emerald-100"
          aria-label="Sao chép link vào thi"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <span className="text-caption text-faint">
        {copied ? "Đã sao chép link" : "Mã vào thi · học sinh vào được ngay"}
      </span>
    </div>
  );
}
