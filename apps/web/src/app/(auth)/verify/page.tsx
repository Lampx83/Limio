"use client";

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
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="text-3xl font-bold">Xác thực email</h1>
      {status === "loading" && <p className="mt-6 text-slate-500">Đang xác thực...</p>}
      {status === "ok" && (
        <>
          <p className="mt-6 text-emerald-600">Đã xác thực. Bạn có thể đăng nhập và enroll course có phí.</p>
          <a href="/signin" className="mt-4 inline-block underline">Đăng nhập</a>
        </>
      )}
      {status === "error" && (
        <p className="mt-6 text-red-600">Lỗi: {error}. Token có thể đã hết hạn hoặc đã được sử dụng.</p>
      )}
    </main>
  );
}
