"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Build-time base path (e.g. "/limio"). Empty string when served from root.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
import { LimeSliceIcon } from "@/components/BrandIcons";

interface DemoAccount {
  email: string;
  label: string;
  roleLabel: string;
  hint: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "alice@feedbackme.dev",
    label: "Alice",
    roleLabel: "Instructor",
    hint: "Owner của khóa Đại số cơ bản — tạo quiz, sửa course, xem analytics.",
  },
  {
    email: "bob@feedbackme.dev",
    label: "Bob",
    roleLabel: "Learner đang học",
    hint: "Đã enroll Đại số cơ bản, hoàn thành 2/4 lesson — test resume + progress.",
  },
  {
    email: "charlie@feedbackme.dev",
    label: "Charlie",
    roleLabel: "Learner mới",
    hint: "Chưa enroll khóa nào — test luồng catalog → enroll → học.",
  },
  {
    email: "admin@feedbackme.dev",
    label: "Admin",
    roleLabel: "Admin",
    hint: "Có quyền chỉnh mọi course, gán role qua API admin.",
  },
];

const DEMO_PASSWORD = "password1234";
const SHOW_DEMO = process.env.NODE_ENV !== "production";

type ProvidersMap = Record<string, { id: string; name: string }>;

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProvidersMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE}/api/auth/providers`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setProviders(data as ProvidersMap);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const hasGoogle = providers != null && "google" in providers;
  const hasMicrosoft = providers != null && "microsoft-entra-id" in providers;
  const hasSso = hasGoogle || hasMicrosoft;

  async function doSignIn(emailValue: string, passwordValue: string) {
    setStatus("submitting");
    setError(null);
    const result = await signIn("credentials", {
      email: emailValue,
      password: passwordValue,
      redirect: false,
    });
    if (result?.error) {
      setStatus("error");
      setError("Email hoặc mật khẩu không đúng.");
    } else {
      // router.push respects Next.js basePath; window.location.href would not.
      router.push("/");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await doSignIn(email, password);
  }

  function fillDemo(emailValue: string) {
    setEmail(emailValue);
    setPassword(DEMO_PASSWORD);
  }

  async function loginAsDemo(emailValue: string) {
    setEmail(emailValue);
    setPassword(DEMO_PASSWORD);
    await doSignIn(emailValue, DEMO_PASSWORD);
  }

  return (
    <main className="relative min-h-[calc(100vh-65px)] overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-brand-gradient-soft" aria-hidden />
      <div className="absolute inset-0 -z-10 bg-hero-grid opacity-40" style={{ backgroundSize: "24px 24px" }} aria-hidden />

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[1fr_minmax(380px,420px)] lg:py-20">
        {/* Left — pitch */}
        <div className="hidden flex-col justify-center lg:flex">
          <span className="chip-brand w-max">Welcome back</span>
          <h1 className="mt-4 h-display text-4xl font-bold leading-tight">
            Quay lại nhịp học cùng <span className="text-gradient">Limio</span>
          </h1>
          <p className="mt-4 max-w-md text-muted">
            Tiếp tục từ chỗ bạn dừng lại — tracking BKT, streak, và XP của bạn
            vẫn ở đó chờ bạn.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Adaptive learning path theo skill mastery",
              "AI tutor luôn sẵn sàng giải thích lại bài",
              "XP, badge, leaderboard — học là cuộc chơi",
            ].map((line) => (
              <li key={line} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-success-100 text-success-700">
                  ✓
                </span>
                <span className="text-muted">{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right — form */}
        <div className="mx-auto w-full max-w-md animate-fade-in-up">
          <div className="card shadow-card-hover">
            <div className="text-center">
              <LimeSliceIcon className="mx-auto h-14 w-14 drop-shadow-md" />
              <h1 className="mt-4 h-display text-2xl font-bold">Đăng nhập</h1>
              <p className="mt-1 text-sm text-muted">
                Chào mừng quay lại               </p>
            </div>

            {hasSso && (
              <div className="mt-6 space-y-2">
                {hasGoogle && (
                  <button
                    type="button"
                    onClick={() => signIn("google", { callbackUrl: `${BASE}/` })}
                    className="btn-secondary flex w-full items-center justify-center gap-2"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path
                        fill="#4285F4"
                        d="M22.5 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.85 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.99 10.99 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.67-2.84z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.67 2.84C6.71 7.31 9.14 5.38 12 5.38z"
                      />
                    </svg>
                    Đăng nhập với Google
                  </button>
                )}
                {hasMicrosoft && (
                  <button
                    type="button"
                    onClick={() =>
                      signIn("microsoft-entra-id", { callbackUrl: `${BASE}/` })
                    }
                    className="btn-secondary flex w-full items-center justify-center gap-2"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 23 23"
                      aria-hidden
                    >
                      <path fill="#f25022" d="M1 1h10v10H1z" />
                      <path fill="#7fba00" d="M12 1h10v10H12z" />
                      <path fill="#00a4ef" d="M1 12h10v10H1z" />
                      <path fill="#ffb900" d="M12 12h10v10H12z" />
                    </svg>
                    Đăng nhập với Microsoft
                  </button>
                )}
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center" aria-hidden>
                    <span className="w-full border-t border-base-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-faint">hoặc</span>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={onSubmit} className={hasSso ? "space-y-4" : "mt-6 space-y-4"}>
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="input mt-1.5"
                  placeholder="ban@example.com"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="label" htmlFor="password">Mật khẩu</label>
                  <Link href="/reset-request" className="text-xs link">
                    Quên mật khẩu?
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="input mt-1.5"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={status === "submitting"}
                className="btn-primary w-full"
              >
                {status === "submitting" ? "Đang xử lý..." : "Đăng nhập"}
              </button>
              {error && (
                <div className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
                  {error}
                </div>
              )}
            </form>

            <p className="mt-6 text-center text-sm text-muted">
              Chưa có tài khoản?{" "}
              <Link href="/register" className="link font-medium">
                Đăng ký
              </Link>
            </p>
          </div>

          {SHOW_DEMO && (
            <section className="mt-6 rounded-2xl border border-accent-200 bg-accent-50 p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-500 text-xs font-bold text-white">
                                  </span>
                <h2 className="text-sm font-semibold text-accent-900">
                  Tài khoản demo (dev only)
                </h2>
              </div>
              <p className="mt-2 text-xs text-accent-800">
                Mật khẩu chung:{" "}
                <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono">
                  {DEMO_PASSWORD}
                </code>
              </p>
              <ul className="mt-3 space-y-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <li
                    key={acc.email}
                    className="rounded-lg border border-accent-200 bg-white p-3 text-sm"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <span className="font-semibold">{acc.label}</span>
                        <span className="ml-2 chip">{acc.roleLabel}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => fillDemo(acc.email)}
                          className="btn-ghost btn-sm"
                        >
                          Điền
                        </button>
                        <button
                          type="button"
                          onClick={() => loginAsDemo(acc.email)}
                          disabled={status === "submitting"}
                          className="btn-primary btn-sm"
                        >
                          Vào
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 font-mono text-xs text-faint">{acc.email}</p>
                    <p className="mt-1 text-xs text-muted">{acc.hint}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
