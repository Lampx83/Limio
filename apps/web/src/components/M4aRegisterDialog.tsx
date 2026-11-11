"use client";

import { signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { withCallbackUrl } from "@/lib/callbackUrl";
import type { M4aLang } from "@/lib/micro4asia";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const T: Record<
  M4aLang,
  {
    title: string;
    intro: string;
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
    intro: "One account for all MICRO4ASIA courses on Limio.",
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
    intro: "Một tài khoản cho mọi khoá học MICRO4ASIA trên Limio.",
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
export default function M4aRegisterDialog({ lang, label }: { lang: M4aLang; label: string }) {
  const t = T[lang];
  const ref = useRef<HTMLDialogElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [error, setError] = useState<"taken" | string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const back = lang === "vi" ? "/micro4asia?lang=vi" : "/micro4asia";

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
    "mt-1.5 block w-full border border-[#B2B2B2] bg-white px-3 py-2.5 text-sm text-[#1B2733] focus:border-[#00528C] focus:outline-none focus:ring-2 focus:ring-[#00528C]/20";

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="bg-[#00528C] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#0E4877]"
      >
        {label} →
      </button>

      <dialog
        ref={ref}
        aria-labelledby="m4a-reg-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md border-t-4 border-[#00528C] bg-white p-0 text-[#1B2733] shadow-2xl backdrop:bg-[#0E4877]/60"
      >
        <div className="relative p-6 sm:p-8">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label={t.close}
            className="absolute right-3 top-3 p-1.5 text-[#4B5B6B] hover:bg-[#D6EEFB]/60 hover:text-[#00528C]"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          <h2 id="m4a-reg-title" className="border-l-4 border-[#FFC101] pl-3 text-2xl font-bold text-[#00528C]">
            {t.title}
          </h2>
          <p className="mt-2 text-sm text-[#4B5B6B]">{t.intro}</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="m4a-name" className="text-sm font-semibold">
                {t.name}
              </label>
              <input
                id="m4a-name"
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
              <label htmlFor="m4a-email" className="text-sm font-semibold">
                {t.email}
              </label>
              <input
                id="m4a-email"
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
              <label htmlFor="m4a-pw" className="text-sm font-semibold">
                {t.password}
              </label>
              <div className="relative">
                <input
                  id="m4a-pw"
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
                  className="absolute inset-y-0 right-0 mt-1.5 px-3 text-xs font-semibold text-[#00528C]"
                >
                  {showPw ? t.hide : t.show}
                </button>
              </div>
              <p className="mt-1 text-xs text-[#6B7A89]">{t.passwordHelp}</p>
            </div>

            <button
              type="submit"
              disabled={status === "submitting"}
              className="w-full bg-[#00528C] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#0E4877] disabled:opacity-60"
            >
              {status === "submitting" ? t.submitting : t.submit}
            </button>

            {error && (
              <div role="alert" className="border-l-4 border-[#C41212] bg-[#FDECEC] px-3 py-2 text-sm text-[#8A0E0E]">
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
              <div role="status" className="border-l-4 border-[#00528C] bg-[#D6EEFB] px-3 py-2 text-sm text-[#0E4877]">
                {info}
              </div>
            )}
          </form>

          <p className="mt-5 text-center text-sm text-[#4B5B6B]">
            {t.haveAccount}{" "}
            <a href={withCallbackUrl("/signin", back)} className="font-semibold text-[#00528C] hover:underline">
              {t.signIn}
            </a>
          </p>
        </div>
      </dialog>
    </>
  );
}
