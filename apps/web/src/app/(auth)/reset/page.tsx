"use client";

import { useEffect, useState } from "react";

export default function ResetPage() {
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    if (t) setToken(t);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    if (res.ok) {
      setStatus("ok");
    } else {
      const data = await res.json().catch(() => ({}));
      setStatus("error");
      setError(data.error ?? "reset_failed");
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-bold">Đặt mật khẩu mới</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Mật khẩu mới</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 dark:bg-slate-900 dark:border-slate-700"
          />
        </label>
        <button
          type="submit"
          disabled={!token || status === "submitting"}
          className="w-full rounded bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {status === "submitting" ? "Đang lưu..." : "Đặt mật khẩu mới"}
        </button>
      </form>
      {status === "ok" && (
        <p className="mt-4 text-emerald-600">
          Đã đổi mật khẩu. <a href="/signin" className="underline">Đăng nhập</a>.
        </p>
      )}
      {status === "error" && <p className="mt-4 text-red-600">Lỗi: {error}</p>}
      {!token && <p className="mt-4 text-sm text-slate-500">Thiếu token trong URL.</p>}
    </main>
  );
}
