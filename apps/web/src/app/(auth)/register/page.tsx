"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
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
          ? "Tài khoản đã được tạo nhưng chúng tôi chưa gửi được email xác thực. Vui lòng thử lại sau ít phút hoặc liên hệ quản trị viên."
          : `Tài khoản đã được tạo. Chúng tôi đã gửi email xác thực tới ${data.email ?? email} — hãy kiểm tra hộp thư (cả mục Spam).`,
      );
    } else {
      setStatus("error");
      if (data.error === "email_taken") {
        setMessage(
          <>
            <p>Email này đã có tài khoản trên hệ thống.</p>
            <p className="mt-1">
              <Link href={withCallbackUrl("/signin", callbackPath)} className="link font-medium">
                Đăng nhập
              </Link>
              {" · Chưa từng đặt mật khẩu? "}
              <Link href="/reset-request" className="link font-medium">
                Quên mật khẩu
              </Link>
            </p>
          </>,
        );
      } else {
        setMessage(data.message ?? `Lỗi: ${data.error ?? "unknown"}`);
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
          <span className="chip-brand w-max">Bắt đầu miễn phí</span>
          <h1 className="mt-4 h-display text-4xl font-bold leading-tight">
            Học thông minh hơn với{" "}
            <span className="text-gradient">Limio</span>
          </h1>
          <p className="mt-4 max-w-md text-muted">
            Tạo tài khoản học viên trong 30 giây. Vào lớp của thầy cô, làm bài và
            biết ngay mình đúng, sai ở đâu.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              { i: "", t: "Vào lớp bằng link mời", d: "Bấm link hoặc nhập mã thầy cô gửi là vào học" },
              { i: "", t: "Phản hồi sau mỗi bài", d: "Biết mình sai ở đâu để sửa kịp" },
              { i: "", t: "Hỏi AI trong bài học", d: "Nhờ giải thích lại hoặc tóm tắt bài đang học" },
              { i: "", t: "Điểm thưởng & huy hiệu", d: "Giữ nhịp học đều mỗi ngày" },
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
              <h1 className="mt-4 h-display text-2xl font-bold">Tạo tài khoản học viên</h1>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <p className="text-xs text-muted"><span className="text-danger-600" aria-hidden>*</span> Trường bắt buộc</p>
              <div>
                <label className="label" htmlFor="displayName">Tên hiển thị<span className="text-danger-600" aria-hidden> *</span></label>
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
                <label className="label" htmlFor="email">Email<span className="text-danger-600" aria-hidden> *</span></label>
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
                <label className="label" htmlFor="password">Mật khẩu<span className="text-danger-600" aria-hidden> *</span></label>
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
                    placeholder="Tối thiểu 8 ký tự"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-xs text-neutral-500 hover:text-neutral-700"
                  >
                    {showPassword ? "Ẩn" : "Hiện"}
                  </button>
                </div>
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
              <Link href={withCallbackUrl("/signin", callbackPath)} className="link font-medium">
                Đăng nhập
              </Link>
            </p>
            <p className="mt-2 text-center text-sm text-muted">
              Bạn là giáo viên?{" "}
              <Link href="/register/instructor" className="link font-medium">
                Đăng ký tài khoản giáo viên
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
