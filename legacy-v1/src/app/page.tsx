import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BrandLogo } from "@/components/BrandLogo";
import ThemeToggle from "@/components/ThemeToggle";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    if (user.role === "student") redirect("/student");
    if (user.role === "instructor") redirect("/instructor");
    if (user.role === "institution_admin") redirect("/institution-admin");
    if (user.role === "system_admin") redirect("/admin");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="max-w-2xl text-center">
        <div className="mb-4 flex justify-center">
          <BrandLogo size="lg" />
        </div>
        <p className="text-lg text-slate-700 dark:text-slate-200 mb-2 font-medium">
          🐯 Trợ giảng AI vui tươi của bạn
        </p>
        <p className="text-base text-slate-600 dark:text-slate-300 mb-2">
          Phản hồi cá nhân hoá - Học có hướng dẫn - Tự điều chỉnh
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
          Khoá học demo: <em>Nhập môn Công nghệ Giáo dục</em>
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/login" className="btn-primary">
            Đăng nhập
          </Link>
          <Link href="/register" className="btn-secondary">
            Đăng ký sinh viên
          </Link>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-10">
          Khung Hattie & Timperley · Felder-Silverman LSI · MSLQ-SRL · Human-in-the-loop
        </p>
      </div>
    </main>
  );
}
