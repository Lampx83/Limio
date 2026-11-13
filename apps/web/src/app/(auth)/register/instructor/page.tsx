"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Check } from "lucide-react";
import { LimeSliceIcon } from "@/components/BrandIcons";
import { apiUrl } from "@/lib/apiUrl";

// Đăng ký tài khoản giáo viên: tạo tài khoản học viên + một đơn chờ admin duyệt.
// Tách khỏi /register để người đăng ký thường không phải đọc một form dài.
export default function RegisterInstructorPage() {
  const t = useT();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [institution, setInstitution] = useState("");
  const [subject, setSubject] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const [motivation, setMotivation] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [message, setMessage] = useState<React.ReactNode>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setMessage(null);
    const res = await fetch(apiUrl("/api/auth/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        displayName,
        instructorApplication: { institution, subject, motivation, verificationUrl },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus("ok");
      setMessage(
        data.emailSent === false
          ? t("auth.instructor.sentNoEmail")
          : t("auth.instructor.sent", { email: data.email ?? email }),
      );
    } else {
      setStatus("error");
      if (data.error === "email_taken") {
        setMessage(
          <>
            <p>{t("auth.instructor.emailTaken")}</p>
            <p className="mt-1">
              <Link href="/signin" className="link font-medium">
                {t("auth.signIn")}
              </Link>
              {" · "}{t("auth.neverSetPasswordQ")}{" "}
              <Link href="/reset-request" className="link font-medium">
                {t("auth.forgotPassword")}
              </Link>
            </p>
            <p className="mt-1">{t("auth.instructor.emailTakenNext")}</p>
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

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[1fr_minmax(380px,460px)] lg:py-20">
        {/* Left — giá trị và quy trình duyệt */}
        <div className="hidden flex-col justify-center lg:flex">
          <span className="chip-brand w-max">{t("auth.instructor.chip")}</span>
          <h1 className="mt-4 h-display text-4xl font-bold leading-tight">
            {t("auth.instructor.pitchTitle")} <span className="text-gradient">Limio</span>
          </h1>
          <p className="mt-4 max-w-md text-muted">
            {t("auth.instructor.pitchBody")}
          </p>
          <ol className="mt-8 max-w-md space-y-4 text-sm">
            {[
              [t("auth.instructor.step1.t"), t("auth.instructor.step1.d")],
              [t("auth.instructor.step2.t"), t("auth.instructor.step2.d")],
              [t("auth.instructor.step3.t"), t("auth.instructor.step3.d")],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span>
                  <span className="block font-semibold">{t}</span>
                  <span className="text-muted">{d}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-md rounded-xl border border-token bg-[rgb(var(--surface))]/60 p-3.5 text-sm text-muted backdrop-blur">
            {t("auth.instructor.trialPre")}{" "}
            <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-800">Trial</span>
            {t("auth.instructor.trialPost")}
          </p>
        </div>

        {/* Right — form */}
        <div className="mx-auto w-full max-w-md animate-fade-in-up">
          <div className="card shadow-card-hover">
            <div className="text-center">
              <LimeSliceIcon className="mx-auto h-14 w-14 drop-shadow-md" />
              <h1 className="mt-4 h-display text-2xl font-bold">{t("auth.instructor.title")}</h1>
              <p className="mt-1 text-sm text-muted">{t("auth.instructor.subtitle")}</p>
            </div>

            {status === "ok" ? (
              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-2.5 rounded-lg border border-success-100 bg-success-50 px-3 py-3 text-sm text-success-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{message}</span>
                </div>
                <Link href="/signin" className="btn-primary w-full">
                  {t("auth.instructor.toSignIn")}
                </Link>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <p className="text-xs text-muted"><span className="text-danger-600" aria-hidden>*</span> {t("auth.requiredNote")}</p>
                <div>
                  <label className="label" htmlFor="displayName">{t("auth.instructor.fullName")}<span className="text-danger-600" aria-hidden> *</span></label>
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    maxLength={80}
                    className="input mt-1.5"
                    placeholder={t("auth.instructor.fullNamePlaceholder")}
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
                    placeholder={t("auth.instructor.emailPlaceholder")}
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
                </div>

                <hr className="border-token" />

                <div>
                  <label className="label" htmlFor="institution">{t("auth.instructor.institution")}<span className="text-danger-600" aria-hidden> *</span></label>
                  <input
                    id="institution"
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    required
                    maxLength={200}
                    className="input mt-1.5"
                    placeholder={t("auth.instructor.institutionPlaceholder")}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="subject">{t("auth.instructor.subject")}<span className="text-danger-600" aria-hidden> *</span></label>
                  <input
                    id="subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    maxLength={200}
                    className="input mt-1.5"
                    placeholder={t("auth.instructor.subjectPlaceholder")}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="verificationUrl">
                    {t("auth.instructor.verifyUrl")} <span className="font-normal text-muted">{t("auth.optional")}</span>
                  </label>
                  <input
                    id="verificationUrl"
                    type="url"
                    value={verificationUrl}
                    onChange={(e) => setVerificationUrl(e.target.value)}
                    maxLength={500}
                    className="input mt-1.5"
                    placeholder={t("auth.instructor.verifyUrlPlaceholder")}
                  />
                  <span className="help">{t("auth.instructor.verifyUrlHelp")}</span>
                </div>
                <div>
                  <label className="label" htmlFor="motivation">
                    {t("auth.instructor.motivation")} <span className="font-normal text-muted">{t("auth.optional")}</span>
                  </label>
                  <textarea
                    id="motivation"
                    value={motivation}
                    onChange={(e) => setMotivation(e.target.value)}
                    maxLength={2000}
                    rows={3}
                    className="input mt-1.5 w-full"
                    placeholder={t("auth.instructor.motivationPlaceholder")}
                  />
                </div>

                <button type="submit" disabled={status === "submitting"} className="btn-primary w-full">
                  {status === "submitting" ? t("auth.sending") : t("auth.instructor.submit")}
                </button>
                {status === "error" && message && (
                  <div className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
                    {message}
                  </div>
                )}
              </form>
            )}

            <p className="mt-6 text-center text-sm text-muted">
              {t("auth.haveAccountQ")}{" "}
              <Link href="/signin" className="link font-medium">{t("auth.signIn")}</Link>
              {" · "}
              <Link href="/register" className="link font-medium">{t("auth.instructor.registerLearner")}</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
