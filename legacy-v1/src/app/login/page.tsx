"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import ThemeToggle from "@/components/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Đăng nhập thất bại");
        return;
      }
      const role = data.role as string;
      if (role === "student") router.push("/student");
      else if (role === "instructor") router.push("/instructor");
      else if (role === "institution_admin") router.push("/institution-admin");
      else if (role === "system_admin") router.push("/admin");
      else router.push("/");
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
        <h1 className="text-2xl font-bold mb-1 dark:text-slate-50">Đăng nhập</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Sử dụng tài khoản đã được cấp.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Tên đăng nhập</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="username"
            />
          </div>
          <div>
            <label className="label">Mật khẩu</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded p-2">
              {error}
            </div>
          )}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
        <div className="mt-6 text-sm text-center">
          <Link href="/register" className="text-brand-600 hover:underline">
            Đăng ký sinh viên mới
          </Link>
          <span className="text-slate-400 mx-2">·</span>
          <Link href="/" className="text-slate-500 hover:underline">
            Về trang chủ
          </Link>
        </div>
        <details className="mt-6 text-xs text-slate-500 dark:text-slate-400">
          <summary className="cursor-pointer">Tài khoản demo</summary>
          <ul className="mt-2 space-y-1 font-mono">
            <li>admin / admin123</li>
            <li>gv.huyen / teacher123</li>
            <li>sv001 / student123 (control)</li>
            <li>sv003 / student123 (personalized)</li>
          </ul>
        </details>
      </div>
    </main>
  );
}
