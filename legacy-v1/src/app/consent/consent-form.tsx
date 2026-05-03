"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConsentForm({ version }: { version: string }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(consent: boolean) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, consented: consent }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Lưu thất bại");
        return;
      }
      if (consent) {
        router.push("/student/onboarding");
      } else {
        // Đăng xuất nếu từ chối
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
      <label className="flex items-start gap-2 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 w-5 h-5"
        />
        <span className="text-sm">
          Tôi đã đọc, hiểu và đồng ý tham gia nghiên cứu này. Tôi xác nhận tham
          gia trên cơ sở tự nguyện.
        </span>
      </label>
      {error && <div className="text-sm text-rose-600 mb-2">{error}</div>}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => submit(true)}
          disabled={!agreed || submitting}
          className="btn-primary"
        >
          {submitting ? "Đang lưu..." : "Đồng ý tham gia"}
        </button>
        <button
          onClick={() => submit(false)}
          disabled={submitting}
          className="btn-secondary"
        >
          Tôi từ chối tham gia
        </button>
      </div>
    </div>
  );
}
