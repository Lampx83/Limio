"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { apiUrl } from "@/lib/apiUrl";

export default function ResetPage() {
  const t = useT();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    const res = await fetch(apiUrl("/api/auth/reset"), {
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
    <main className="relative min-h-[calc(100vh-65px)] overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-brand-gradient-soft" aria-hidden />
      <div className="absolute inset-0 -z-10 bg-hero-grid opacity-40" style={{ backgroundSize: "24px 24px" }} aria-hidden />

      <div className="mx-auto max-w-md px-6 py-16">
        <div className="card shadow-card-hover animate-fade-in-up">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gradient text-lg font-bold text-white shadow-brand-glow">
                          </div>
            <h1 className="mt-4 h-display text-2xl font-bold">
              {t("auth.reset.title")}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {t("auth.reset.subtitle")}
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="rs-pw">{t("auth.reset.newPassword")}</label>
              <div className="relative mt-1.5">
                <input
                  id="rs-pw"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder={t("auth.passwordPlaceholder")}
                  className="input w-full pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-xs text-neutral-500 hover:text-neutral-700"
                >
                  {showPassword ? t("auth.hide") : t("auth.show")}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={!token || status === "submitting"}
              className="btn-primary w-full"
            >
              {status === "submitting" ? t("auth.saving") : t("auth.reset.submit")}
            </button>
            {status === "ok" && (
              <div className="rounded-lg border border-success-100 bg-success-50 px-3 py-2 text-sm text-success-700">
                {t("auth.reset.done")}{" "}
                <Link href="/signin" className="font-semibold underline">
                  {t("auth.reset.signInNow")}
                </Link>
              </div>
            )}
            {status === "error" && (
              <div className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
                {t("auth.errorWith", { error: error ?? "" })}
              </div>
            )}
            {!token && (
              <p className="text-xs text-faint">
                {t("auth.reset.missingToken")}
              </p>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
