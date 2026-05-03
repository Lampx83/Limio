"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function VerifyPage() {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      setError("Thiếu token");
      return;
    }
    fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) {
          setStatus("ok");
        } else {
          const data = await res.json().catch(() => ({}));
          setStatus("error");
          setError(data.error ?? "verify_failed");
        }
      })
      .catch(() => {
        setStatus("error");
        setError("network_error");
      });
  }, []);

  return (
    <main className="relative min-h-[calc(100vh-65px)] overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-brand-gradient-soft" aria-hidden />
      <div className="absolute inset-0 -z-10 bg-hero-grid opacity-40" style={{ backgroundSize: "24px 24px" }} aria-hidden />

      <div className="mx-auto max-w-md px-6 py-16">
        <div className="card text-center shadow-card-hover animate-fade-in-up">
          <div
            className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
              status === "ok"
                ? "bg-success-100 text-success-700"
                : status === "error"
                  ? "bg-danger-100 text-danger-700"
                  : "bg-brand-soft text-brand-700"
            }`}
          >
            {status === "ok" ? "✓" : status === "error" ? "✕" : "⏳"}
          </div>
          <h1 className="mt-5 h-display text-2xl font-bold">Xác thực email</h1>

          {status === "loading" && (
            <p className="mt-4 text-muted">Đang xác thực...</p>
          )}
          {status === "ok" && (
            <>
              <p className="mt-4 text-success-700">
                Đã xác thực thành công. Bạn có thể đăng nhập và enroll khóa học.
              </p>
              <Link href="/signin" className="btn-primary mt-6 inline-flex">
                Đăng nhập →
              </Link>
            </>
          )}
          {status === "error" && (
            <>
              <p className="mt-4 text-sm text-danger-700">
                Lỗi: {error}. Token có thể đã hết hạn hoặc đã được sử dụng.
              </p>
              <Link href="/signin" className="btn-secondary mt-6 inline-flex">
                Quay lại đăng nhập
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
