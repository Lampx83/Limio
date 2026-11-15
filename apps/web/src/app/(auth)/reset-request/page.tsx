"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { apiUrl } from "@/lib/apiUrl";

export default function ResetRequestPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "ok">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    await fetch(apiUrl("/api/auth/reset-request"), {
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
              {t("auth.resetRequest.title")}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {t("auth.resetRequest.subtitle")}
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="rr-email">{t("auth.email")}</label>
              <input
                id="rr-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder={t("auth.emailPlaceholder")}
                className="input mt-1.5"
              />
            </div>
            <button
              type="submit"
              disabled={status !== "idle"}
              className="btn-primary w-full"
            >
              {status === "submitting" ? t("auth.sending") : t("auth.resetRequest.submit")}
            </button>
            {status === "ok" && (
              <div className="rounded-lg border border-success-100 bg-success-50 px-3 py-2 text-sm text-success-700">
                {t("auth.resetRequest.sent")}
              </div>
            )}
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            {t("auth.resetRequest.rememberedQ")}{" "}
            <Link href="/signin" className="link font-medium">
              {t("auth.signIn")}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
