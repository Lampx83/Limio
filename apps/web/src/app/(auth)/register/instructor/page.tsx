"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { LimeSliceIcon } from "@/components/BrandIcons";
import { apiUrl } from "@/lib/apiUrl";

// Đăng ký tài khoản giáo viên: tạo tài khoản học viên + một đơn chờ admin duyệt.
// Tách khỏi /register để người đăng ký thường không phải đọc một form dài.
export default function RegisterInstructorPage() {
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
          ? "Đơn của bạn đã được gửi nhưng chúng tôi chưa gửi được email xác thực. Vui lòng thử lại sau ít phút hoặc liên hệ quản trị viên."
          : `Đơn đăng ký đã được gửi. Hãy xác thực email qua thư chúng tôi vừa gửi tới ${data.email ?? email} (cả mục Spam).`,
      );
    } else {
      setStatus("error");
      if (data.error === "email_taken") {
        setMessage(
          <>
            <p>Email này đã có tài khoản.</p>
            <p className="mt-1">
              <Link href="/signin" className="link font-medium">
                Đăng nhập
              </Link>
              {" · Chưa từng đặt mật khẩu? "}
              <Link href="/reset-request" className="link font-medium">
                Quên mật khẩu
              </Link>
            </p>
            <p className="mt-1">Sau đó liên hệ quản trị viên để được cấp quyền giáo viên.</p>
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

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[1fr_minmax(380px,460px)] lg:py-20">
        {/* Left — giá trị và quy trình duyệt */}
        <div className="hidden flex-col justify-center lg:flex">
          <span className="chip-brand w-max">Dành cho giáo viên</span>
          <h1 className="mt-4 h-display text-4xl font-bold leading-tight">
            Dạy đúng nhịp cùng <span className="text-gradient">Limio</span>
          </h1>
          <p className="mt-4 max-w-md text-muted">
            Soạn bài, giao bài tập, tổ chức đợt thi và giảng trực tiếp ở một chỗ, với AI hỗ trợ gợi ý chấm và chữa bài.
          </p>
          <ol className="mt-8 max-w-md space-y-4 text-sm">
            {[
              ["Gửi đơn", "Điền thông tin đơn vị và môn giảng dạy."],
              ["Chờ duyệt", "Quản trị viên xem xét. Trong lúc chờ, bạn dùng tài khoản học viên."],
              ["Nhận email", "Được duyệt, Limio gửi thư chúc mừng và bạn có thể bắt đầu dạy."],
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
            Tài khoản giáo viên miễn phí. Limio-Live và Vấn đáp AI dùng thử được (nhãn{" "}
            <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-800">Trial</span>
            ), và có hạn mức AI token cho các tính năng AI hỗ trợ.
          </p>
        </div>

        {/* Right — form */}
        <div className="mx-auto w-full max-w-md animate-fade-in-up">
          <div className="card shadow-card-hover">
            <div className="text-center">
              <LimeSliceIcon className="mx-auto h-14 w-14 drop-shadow-md" />
              <h1 className="mt-4 h-display text-2xl font-bold">Đăng ký tài khoản giáo viên</h1>
              <p className="mt-1 text-sm text-muted">Đơn sẽ được quản trị viên xem xét</p>
            </div>

            {status === "ok" ? (
              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-2.5 rounded-lg border border-success-100 bg-success-50 px-3 py-3 text-sm text-success-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{message}</span>
                </div>
                <Link href="/signin" className="btn-primary w-full">
                  Đến trang đăng nhập
                </Link>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <p className="text-xs text-muted"><span className="text-danger-600" aria-hidden>*</span> Trường bắt buộc</p>
                <div>
                  <label className="label" htmlFor="displayName">Họ và tên<span className="text-danger-600" aria-hidden> *</span></label>
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    maxLength={80}
                    className="input mt-1.5"
                    placeholder="Nguyễn Thị Lan"
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
                    placeholder="ban@truong.edu.vn"
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
                </div>

                <hr className="border-token" />

                <div>
                  <label className="label" htmlFor="institution">Trường / đơn vị công tác<span className="text-danger-600" aria-hidden> *</span></label>
                  <input
                    id="institution"
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    required
                    maxLength={200}
                    className="input mt-1.5"
                    placeholder="Trường THPT Chu Văn An"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="subject">Môn / lĩnh vực giảng dạy<span className="text-danger-600" aria-hidden> *</span></label>
                  <input
                    id="subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    maxLength={200}
                    className="input mt-1.5"
                    placeholder="Toán, Tiếng Anh, Lập trình..."
                  />
                </div>
                <div>
                  <label className="label" htmlFor="verificationUrl">
                    Link xác minh <span className="font-normal text-muted">(không bắt buộc)</span>
                  </label>
                  <input
                    id="verificationUrl"
                    type="url"
                    value={verificationUrl}
                    onChange={(e) => setVerificationUrl(e.target.value)}
                    maxLength={500}
                    className="input mt-1.5"
                    placeholder="Trang giảng viên của trường, LinkedIn..."
                  />
                  <span className="help">Giúp quản trị viên duyệt nhanh hơn.</span>
                </div>
                <div>
                  <label className="label" htmlFor="motivation">
                    Giới thiệu ngắn <span className="font-normal text-muted">(không bắt buộc)</span>
                  </label>
                  <textarea
                    id="motivation"
                    value={motivation}
                    onChange={(e) => setMotivation(e.target.value)}
                    maxLength={2000}
                    rows={3}
                    className="input mt-1.5 w-full"
                    placeholder="Bạn muốn dạy gì trên Limio?"
                  />
                </div>

                <button type="submit" disabled={status === "submitting"} className="btn-primary w-full">
                  {status === "submitting" ? "Đang gửi..." : "Gửi đơn đăng ký"}
                </button>
                {status === "error" && message && (
                  <div className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
                    {message}
                  </div>
                )}
              </form>
            )}

            <p className="mt-6 text-center text-sm text-muted">
              Đã có tài khoản?{" "}
              <Link href="/signin" className="link font-medium">Đăng nhập</Link>
              {" · "}
              <Link href="/register" className="link font-medium">Đăng ký học viên</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
