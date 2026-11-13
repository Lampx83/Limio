"use client";

import { getSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { apiUrl } from "@/lib/apiUrl";
import { sanitizeCallbackUrl, withCallbackUrl } from "@/lib/callbackUrl";
import { landingPathForRoles } from "@/lib/landing";

export default function VerifyPage() {
  const t = useT();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  // Link trong email mang theo trang học viên đang muốn tới lúc đăng ký (vd
  // link mời vào lớp). Đã đăng nhập sẵn (đăng ký xong được vào thẳng) ⇒ đi
  // tiếp luôn; chưa ⇒ đăng nhập rồi về đúng trang đó.
  const [callbackPath, setCallbackPath] = useState("/");
  const [continuePath, setContinuePath] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = sanitizeCallbackUrl(params.get("callbackUrl"));
    setCallbackPath(target);
    getSession()
      .then((session) => {
        if (session?.user) {
          setContinuePath(target !== "/" ? target : landingPathForRoles(session.user.roles ?? []));
        }
      })
      .catch(() => {});
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setError("Thiếu token");
      return;
    }
    fetch(apiUrl(`/api/auth/verify?token=${encodeURIComponent(token)}`))
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
            {status === "ok" ? "✓" : status === "error" ? "✕" : ""}
          </div>
          <h1 className="mt-5 h-display text-2xl font-bold">{t("auth.verify.title")}</h1>

          {status === "loading" && (
            <p className="mt-4 text-muted">{t("auth.verify.loading")}</p>
          )}
          {status === "ok" && (
            <>
              <p className="mt-4 text-success-700">{t("auth.verify.ok")}</p>
              {continuePath ? (
                <Link href={continuePath} className="btn-primary mt-6 inline-flex">
                  {t("auth.continue")}
                </Link>
              ) : (
                <Link href={withCallbackUrl("/signin", callbackPath)} className="btn-primary mt-6 inline-flex">
                  {t("auth.signIn")} →
                </Link>
              )}
            </>
          )}
          {status === "error" && (
            <>
              <p className="mt-4 text-sm text-danger-700">
                {error === "network_error"
                  ? t("auth.verify.networkError")
                  : t("auth.verify.expired")}
              </p>
              {continuePath ? (
                <Link href={continuePath} className="btn-secondary mt-6 inline-flex">
                  {t("auth.continue")}
                </Link>
              ) : (
                <Link href={withCallbackUrl("/signin", callbackPath)} className="btn-secondary mt-6 inline-flex">
                  {t("auth.backToSignIn")}
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
