"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import ThemeToggle from "@/components/ThemeToggle";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, fullName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Đăng ký thất bại");
        return;
      }
      router.push("/student/onboarding");
    } catch {
      setError("Lỗi kết nối, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="card p-8 w-full max-w-md">
        <div className="mb-4 flex justify-center"><BrandLogo size="sm" /></div>
        <h1 className="text-2xl font-bold mb-1 dark:text-slate-50">Đăng ký sinh viên</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Bạn sẽ được phân ngẫu nhiên vào nhóm đối chứng hoặc nhóm cá nhân hoá.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Họ và tên</label>
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              minLength={2}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Tên đăng nhập (chỉ chữ/số, không dấu)</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              required
              pattern="^[a-z0-9_.]{3,20}$"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="label">Mật khẩu (tối thiểu 6 ký tự)</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded p-2">
              {error}
            </div>
          )}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Đang xử lý..." : "Đăng ký và bắt đầu"}
          </button>
        </form>
        <div className="mt-6 text-sm text-center">
          <Link href="/login" className="text-brand-600 hover:underline">
            Đã có tài khoản? Đăng nhập
          </Link>
        </div>
      </div>
    </main>
  );
}
