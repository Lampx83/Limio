"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { LimeSliceIcon } from "@/components/BrandIcons";
import { apiUrl } from "@/lib/apiUrl";
import { sanitizeCallbackUrl, withCallbackUrl } from "@/lib/callbackUrl";

// Build-time base path (e.g. "/limio"). Empty string when served from root.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// RegisterForm đọc ?callbackUrl= qua useSearchParams — App Router bắt buộc bọc
// Suspense cho client component dùng hook này.
export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const t = useT();
  // Đích quay về (vd link mời vào lớp /enroll/<mã>) — đi theo học viên qua
  // đăng ký, đăng nhập tự động và cả link xác minh trong email.
  const callbackPath = sanitizeCallbackUrl(useSearchParams().get("callbackUrl"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [message, setMessage] = useState<React.ReactNode>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setMessage(null);
    const res = await fetch(apiUrl("/api/auth/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName, callbackUrl: callbackPath }),
    });
    const data = await res.json();
    if (res.ok) {
      // Đăng nhập chưa đòi xác minh email ⇒ vào thẳng, không bắt học viên mở
      // hộp thư rồi đăng nhập lại mới tới được lớp. Email xác minh vẫn được gửi.
      const login = await signIn("credentials", { email, password, redirect: false });
      if (!login?.error) {
        // Điều hướng cứng để root layout đọc lại cookie phiên (xem SignInForm).
        window.location.href = `${BASE}${callbackPath === "/" ? "/me/dashboard" : callbackPath}`;
        return;
      }
      setStatus("ok");
      setMessage(
        data.emailSent === false
          ? t("auth.register.createdNoEmail")
          : t("auth.register.createdEmailSent", { email: data.email ?? email }),
      );
    } else {
      setStatus("error");
      if (data.error === "email_taken") {
        setMessage(
          <>
            <p>{t("auth.register.emailTaken")}</p>
            <p className="mt-1">
              <Link href={withCallbackUrl("/signin", callbackPath)} className="link font-medium">
                {t("auth.signIn")}
              </Link>
              {" · "}{t("auth.neverSetPasswordQ")}{" "}
              <Link href="/reset-request" className="link font-medium">
                {t("auth.forgotPassword")}
              </Link>
            </p>
          </>,
        );
      } else {
        setMessage(data.message ?? t("auth.errorWith", { error: data.error ?? "unknown" }));
      }
    }
  }

  return (
    <main className="relative min-h-[calc(100vh-65px)] overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-brand-gradient-soft" aria-hidden />
      <div className="absolute inset-0 -z-10 bg-hero-grid opacity-40" style={{ backgroundSize: "24px 24px" }} aria-hidden />

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[1fr_minmax(380px,420px)] lg:py-20">
        {/* Left — value props */}
        <div className="hidden flex-col justify-center lg:flex">
          <span className="chip-brand w-max">{t("auth.register.chip")}</span>
          <h1 className="mt-4 h-display text-4xl font-bold leading-tight">
            {t("auth.register.pitchTitle")}{" "}
            <span className="text-gradient">Limio</span>
          </h1>
          <p className="mt-4 max-w-md text-muted">
            {t("auth.register.pitchBody")}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              { i: "", t: t("auth.register.feat1.t"), d: t("auth.register.feat1.d") },
              { i: "", t: t("auth.register.feat2.t"), d: t("auth.register.feat2.d") },
              { i: "", t: t("auth.register.feat3.t"), d: t("auth.register.feat3.d") },
              { i: "", t: t("auth.register.feat4.t"), d: t("auth.register.feat4.d") },
            ].map((f) => (
              <div key={f.t} className="rounded-xl border border-token bg-[rgb(var(--surface))/0.6] p-3 backdrop-blur">
                <div className="text-xl">{f.i}</div>
                <div className="mt-1 text-sm font-semibold">{f.t}</div>
                <div className="text-xs text-muted">{f.d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        <div className="mx-auto w-full max-w-md animate-fade-in-up">
          <div className="card shadow-card-hover">
            <div className="text-center">
              <LimeSliceIcon className="mx-auto h-14 w-14 drop-shadow-md" />
              <h1 className="mt-4 h-display text-2xl font-bold">{t("auth.register.title")}</h1>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <p className="text-xs text-muted"><span className="text-danger-600" aria-hidden>*</span> {t("auth.requiredNote")}</p>
              <div>
                <label className="label" htmlFor="displayName">{t("auth.register.displayName")}<span className="text-danger-600" aria-hidden> *</span></label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  minLength={1}
                  className="input mt-1.5"
                  placeholder={t("auth.register.displayNamePlaceholder")}
                />
              </div>
              <div>
                <label className="label" htmlFor="email">{t("auth.email")}<span className="text-danger-600" aria-hidden> *</span></label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="input mt-1.5"
                  placeholder={t("auth.emailPlaceholder")}
                />
              </div>
              <div>
                <label className="label" htmlFor="password">{t("auth.password")}<span className="text-danger-600" aria-hidden> *</span></label>
                <div className="relative mt-1.5">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="input w-full pr-12"
                    placeholder={t("auth.passwordPlaceholder")}
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
                <span className="help">{t("auth.register.passwordHelp")}</span>
              </div>
              <button
                type="submit"
                disabled={status === "submitting"}
                className="btn-primary w-full"
              >
                {status === "submitting" ? t("auth.processing") : t("auth.register")}
              </button>
              {message && (
                <div
                  className={`rounded-lg px-3 py-2 text-sm ${
                    status === "ok"
                      ? "border border-success-100 bg-success-50 text-success-700"
                      : "border border-danger-100 bg-danger-50 text-danger-700"
                  }`}
                >
                  {message}
                </div>
              )}
            </form>

            <p className="mt-6 text-center text-sm text-muted">
              {t("auth.haveAccountQ")}{" "}
              <Link href={withCallbackUrl("/signin", callbackPath)} className="link font-medium">
                {t("auth.signIn")}
              </Link>
            </p>
            <p className="mt-2 text-center text-sm text-muted">
              {t("auth.register.askInstructor")}{" "}
              <Link href="/register/instructor" className="link font-medium">
                {t("auth.register.instructorLink")}
              </Link>
            </p>
          </div>

          <p className="mt-4 text-center text-xs text-faint">
            {t("auth.register.terms")}
          </p>
        </div>
      </div>
    </main>
  );
}
