"use client";

import Link from "next/link";
import { useState } from "react";
import { LimeSliceIcon } from "@/components/BrandIcons";
import { apiUrl } from "@/lib/apiUrl";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setMessage(null);
    const res = await fetch(apiUrl("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName }),
    });
    const data = await res.json();
    if (res.ok) {
      setStatus("ok");
      setMessage("Tài khoản tạo OK. Kiểm tra console server để lấy link xác thực email.");
    } else {
      setStatus("error");
      setMessage(`Lỗi: ${data.error ?? "unknown"}`);
    }
  }

  return (
    <main className="relative min-h-[calc(100vh-65px)] overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-brand-gradient-soft" aria-hidden />
      <div className="absolute inset-0 -z-10 bg-hero-grid opacity-40" style={{ backgroundSize: "24px 24px" }} aria-hidden />

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[1fr_minmax(380px,420px)] lg:py-20">
        {/* Left — value props */}
        <div className="hidden flex-col justify-center lg:flex">
          <span className="chip-brand w-max">Bắt đầu miễn phí</span>
          <h1 className="mt-4 h-display text-4xl font-bold leading-tight">
            Học thông minh hơn với{" "}
            <span className="text-gradient">Limio</span>
          </h1>
          <p className="mt-4 max-w-md text-muted">
            Tạo tài khoản trong 30 giây. Nhận feedback cá nhân hóa, lộ trình học
            adaptive, và cộng đồng learners năng động.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              { i: "", t: "Adaptive path", d: "Học đúng thứ bạn cần, đúng lúc" },
              { i: "", t: "AI tutor 24/7", d: "Hỏi gì cũng có người trả lời" },
              { i: "", t: "XP & badge", d: "Gamification giữ động lực" },
              { i: "", t: "Skill profile", d: "Thấy rõ điểm mạnh, điểm yếu" },
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
              <h1 className="mt-4 h-display text-2xl font-bold">Tạo tài khoản</h1>
              <p className="mt-1 text-sm text-muted">Miễn phí — không cần thẻ tín dụng</p>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label className="label" htmlFor="displayName">Tên hiển thị</label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  minLength={1}
                  className="input mt-1.5"
                  placeholder="Nguyễn Văn A"
                />
              </div>
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
                <label className="label" htmlFor="password">Mật khẩu</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="input mt-1.5"
                  placeholder="Tối thiểu 8 ký tự"
                />
                <span className="help">Tối thiểu 8 ký tự, nên trộn chữ + số.</span>
              </div>
              <button
                type="submit"
                disabled={status === "submitting"}
                className="btn-primary w-full"
              >
                {status === "submitting" ? "Đang xử lý..." : "Đăng ký"}
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
              Đã có tài khoản?{" "}
              <Link href="/signin" className="link font-medium">
                Đăng nhập
              </Link>
            </p>
          </div>

          <p className="mt-4 text-center text-xs text-faint">
            Bằng cách đăng ký, bạn đồng ý với điều khoản sử dụng của Limio.
          </p>
        </div>
      </div>
    </main>
  );
}
