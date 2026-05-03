"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

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

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

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
      window.location.href = "/";
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
            Quay lại nhịp học cùng <span className="text-gradient">FeedBackMe</span>
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
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gradient text-lg font-bold text-white shadow-brand-glow">
                F
              </div>
              <h1 className="mt-4 h-display text-2xl font-bold">Đăng nhập</h1>
              <p className="mt-1 text-sm text-muted">
                Chào mừng quay lại 👋
              </p>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
                  ⚡
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
