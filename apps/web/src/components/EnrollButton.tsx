"use client";

import { useState } from "react";

export default function EnrollButton({ slug, alreadyEnrolled }: { slug: string; alreadyEnrolled: boolean }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (alreadyEnrolled) {
    return (
      <a
        href={`/learn/${slug}`}
        className="inline-block rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
      >
        Tiếp tục học →
      </a>
    );
  }

  async function onClick() {
    setStatus("submitting");
    setError(null);
    const res = await fetch(`/api/courses/${slug}/enroll`, { method: "POST" });
    if (res.status === 401) {
      window.location.href = `/signin?callbackUrl=/catalog/${slug}`;
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus("error");
      setError(data.error ?? "enroll_failed");
      return;
    }
    window.location.href = `/learn/${slug}`;
  }

  return (
    <div>
      <button
        onClick={onClick}
        disabled={status === "submitting"}
        className="inline-block rounded bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
      >
        {status === "submitting" ? "Đang đăng ký..." : "Đăng ký miễn phí"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">Lỗi: {error}</p>}
    </div>
  );
}
