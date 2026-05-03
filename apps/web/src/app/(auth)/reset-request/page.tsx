"use client";

import Link from "next/link";
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
    <main className="relative min-h-[calc(100vh-65px)] overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-brand-gradient-soft" aria-hidden />
      <div className="absolute inset-0 -z-10 bg-hero-grid opacity-40" style={{ backgroundSize: "24px 24px" }} aria-hidden />

      <div className="mx-auto max-w-md px-6 py-16">
        <div className="card shadow-card-hover animate-fade-in-up">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gradient text-lg font-bold text-white shadow-brand-glow">
                          </div>
            <h1 className="mt-4 h-display text-2xl font-bold">
              Đặt lại mật khẩu
            </h1>
            <p className="mt-1 text-sm text-muted">
              Nhập email — em sẽ gửi link đặt lại.
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="rr-email">Email</label>
              <input
                id="rr-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="ban@example.com"
                className="input mt-1.5"
              />
            </div>
            <button
              type="submit"
              disabled={status !== "idle"}
              className="btn-primary w-full"
            >
              {status === "submitting" ? "Đang gửi..." : "Gửi link đặt lại"}
            </button>
            {status === "ok" && (
              <div className="rounded-lg border border-success-100 bg-success-50 px-3 py-2 text-sm text-success-700">
                ✓ Nếu email tồn tại, link sẽ được gửi (dev: log ra console server).
              </div>
            )}
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            Nhớ ra rồi?{" "}
            <Link href="/signin" className="link font-medium">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
