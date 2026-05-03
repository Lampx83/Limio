"use client";

import { useState } from "react";

export default function ResetRequestPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "ok">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    await fetch("/api/auth/reset-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setStatus("ok");
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-bold">Đặt lại mật khẩu</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 dark:bg-slate-900 dark:border-slate-700"
          />
        </label>
        <button
          type="submit"
          disabled={status !== "idle"}
          className="w-full rounded bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {status === "submitting" ? "Đang gửi..." : "Gửi link đặt lại"}
        </button>
      </form>
      {status === "ok" && (
        <p className="mt-4 text-sm text-slate-500">
          Nếu email tồn tại, link sẽ được log ra console server (dev mode).
        </p>
      )}
    </main>
  );
}
