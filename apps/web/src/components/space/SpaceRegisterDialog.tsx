"use client";

import { signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { withCallbackUrl } from "@/lib/callbackUrl";
import type { SpaceLang } from "@/lib/space/types";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const T: Record<
  SpaceLang,
  {
    title: string;
    name: string;
    namePh: string;
    email: string;
    password: string;
    passwordHelp: string;
    show: string;
    hide: string;
    submit: string;
    submitting: string;
    close: string;
    haveAccount: string;
    signIn: string;
    taken: string;
    created: (email: string) => string;
    mailFail: string;
    generic: string;
  }
> = {
  en: {
    title: "Create your account",
    name: "Display name",
    namePh: "Your name",
    email: "Email",
    password: "Password",
    passwordHelp: "At least 8 characters.",
    show: "Show",
    hide: "Hide",
    submit: "Create account",
    submitting: "Creating…",
    close: "Close",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
    taken: "This email already has an account.",
    created: (e) => `Account created. We sent a verification email to ${e}. Check your inbox (and spam).`,
    mailFail: "Account created, but we could not send the verification email. Please try again later.",
    generic: "Something went wrong. Please try again.",
  },
  vi: {
    title: "Tạo tài khoản",
    name: "Tên hiển thị",
    namePh: "Tên của bạn",
    email: "Email",
    password: "Mật khẩu",
    passwordHelp: "Tối thiểu 8 ký tự.",
    show: "Hiện",
    hide: "Ẩn",
    submit: "Tạo tài khoản",
    submitting: "Đang tạo…",
    close: "Đóng",
    haveAccount: "Đã có tài khoản?",
    signIn: "Đăng nhập",
    taken: "Email này đã có tài khoản.",
    created: (e) => `Đã tạo tài khoản. Chúng tôi đã gửi email xác thực tới ${e}. Hãy kiểm tra hộp thư (cả mục Spam).`,
    mailFail: "Đã tạo tài khoản nhưng chưa gửi được email xác thực. Vui lòng thử lại sau.",
    generic: "Có lỗi xảy ra. Vui lòng thử lại.",
  },
};

/** Nút "Create an account" mở hộp thoại đăng ký ngay trên trang /micro4asia — không rời trang. */
export default function SpaceRegisterDialog({
  lang,
  label,
  intro,
  backPath,
}: {
  lang: SpaceLang;
  label: string;
  intro: string;
  /** Trang chủ space — nơi quay lại sau khi đăng ký/đăng nhập. */
  backPath: string;
}) {
  const t = T[lang];
  const ref = useRef<HTMLDialogElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [error, setError] = useState<"taken" | string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const back = lang === "vi" ? `${backPath}?lang=vi` : backPath;

  // Bấm ra ngoài hộp thoại thì đóng (phần nền của <dialog> nhận click với target là chính nó).
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onClick = (e: MouseEvent) => {
      if (e.target === d) d.close();
    };
    d.addEventListener("click", onClick);
    return () => d.removeEventListener("click", onClick);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(apiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName, callbackUrl: back }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setError(data.error === "email_taken" ? "taken" : (data.message ?? t.generic));
        return;
      }
      // Cùng cách trang /register: vào thẳng, không bắt mở hộp thư rồi đăng nhập lại.
      const login = await signIn("credentials", { email, password, redirect: false });
      if (!login?.error) {
        window.location.href = `${BASE}${back}`;
        return;
      }
      setStatus("ok");
      setInfo(data.emailSent === false ? t.mailFail : t.created(data.email ?? email));
    } catch {
      setStatus("error");
      setError(t.generic);
    }
  }

  const field =
    "mt-1.5 block w-full border border-[#B2B2B2] bg-white px-3 py-2.5 text-sm text-[#1B2733] focus:border-[color:var(--sp)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--sp)_20%,transparent)]";

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="bg-[var(--sp)] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--sp-dark)]"
      >
        {label} →
      </button>

      <dialog
        ref={ref}
        aria-labelledby="space-reg-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md border-t-4 border-[color:var(--sp)] bg-white p-0 text-[#1B2733] shadow-2xl backdrop:bg-[color-mix(in_srgb,var(--sp-dark)_60%,transparent)]"
      >
        <div className="relative p-6 sm:p-8">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label={t.close}
            className="absolute right-3 top-3 p-1.5 text-[#4B5B6B] hover:bg-[color-mix(in_srgb,var(--sp-soft)_60%,transparent)] hover:text-[color:var(--sp)]"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          <h2 id="space-reg-title" className="border-l-4 border-[color:var(--sp-accent)] pl-3 text-2xl font-bold text-[color:var(--sp)]">
            {t.title}
          </h2>
          <p className="mt-2 text-sm text-[#4B5B6B]">{intro}</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="space-name" className="text-sm font-semibold">
                {t.name}
              </label>
              <input
                id="space-name"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                placeholder={t.namePh}
                className={field}
              />
            </div>
            <div>
              <label htmlFor="space-email" className="text-sm font-semibold">
                {t.email}
              </label>
              <input
                id="space-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                className={field}
              />
            </div>
            <div>
              <label htmlFor="space-pw" className="text-sm font-semibold">
                {t.password}
              </label>
              <div className="relative">
                <input
                  id="space-pw"
                  type={showPw ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className={`${field} pr-16`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-pressed={showPw}
                  className="absolute inset-y-0 right-0 mt-1.5 px-3 text-xs font-semibold text-[color:var(--sp)]"
                >
                  {showPw ? t.hide : t.show}
                </button>
              </div>
              <p className="mt-1 text-xs text-[#6B7A89]">{t.passwordHelp}</p>
            </div>

            <button
              type="submit"
              disabled={status === "submitting"}
              className="w-full bg-[var(--sp)] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--sp-dark)] disabled:opacity-60"
            >
              {status === "submitting" ? t.submitting : t.submit}
            </button>

            {error && (
              <div role="alert" className="border-l-4 border-[color:var(--sp-accent2)] bg-[#FDECEC] px-3 py-2 text-sm text-[#8A0E0E]">
                {error === "taken" ? (
                  <>
                    {t.taken}{" "}
                    <a href={withCallbackUrl("/signin", back)} className="font-semibold underline">
                      {t.signIn}
                    </a>
                  </>
                ) : (
                  error
                )}
              </div>
            )}
            {info && (
              <div role="status" className="border-l-4 border-[color:var(--sp)] bg-[var(--sp-soft)] px-3 py-2 text-sm text-[color:var(--sp-dark)]">
                {info}
              </div>
            )}
          </form>

          <p className="mt-5 text-center text-sm text-[#4B5B6B]">
            {t.haveAccount}{" "}
            <a href={withCallbackUrl("/signin", back)} className="font-semibold text-[color:var(--sp)] hover:underline">
              {t.signIn}
            </a>
          </p>
        </div>
      </dialog>
    </>
  );
}
