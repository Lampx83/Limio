import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROLE_DEFAULT_PATH, getActiveRole } from "@/lib/active-role";
import { isLearnerRole } from "@/lib/learnerRole";
import { NOINDEX } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const session = await auth();
  // Khách thấy trang giới thiệu (index được); người đã đăng nhập bị chuyển đi nên không có gì để index.
  return session?.user?.id ? { title: "Limio Language", ...NOINDEX } : { title: "Limio Language — Speak in Flow" };
}

/**
 * Trang giới thiệu Limio Language cho khách. Người đã đăng nhập không có trang chủ Language riêng nữa (trang "Lộ trình
 * của tôi" đã bỏ vì trùng với học viên Limio thường — docs/tieu-chi/limio-language-gop-menu.md): học viên về trang chủ học
 * viên, giảng viên/admin về trang chủ của họ.
 */
export default async function LanguageHome() {
  const session = await auth();
  if (!session?.user?.id) return <GuestIntro />;
  const activeRole = getActiveRole(session.user.roles ?? []);
  redirect(isLearnerRole(activeRole) ? "/me/dashboard" : (ROLE_DEFAULT_PATH[activeRole] ?? "/instructor/dashboard"));
}

function GuestIntro() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="text-display">
        Limio <span className="text-lime-600">Language</span>
      </h1>
      <p className="font-[family-name:var(--font-script)] mt-2 text-xl italic text-lime-700">Speak in Flow</p>
      <p className="text-body mx-auto mt-6 max-w-xl">
        Học ngoại ngữ trên Limio: bài nghe, từ vựng và hội thoại có âm thanh, luyện đề và thi thử bấm giờ theo từng kỹ năng,
        góp ý bài viết và bài nói bằng AI có giảng viên duyệt.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/signin?callbackUrl=/language" className="btn-primary">
          Đăng nhập
        </Link>
        <Link href="/catalog" className="btn-ghost">
          Xem các khoá học
        </Link>
      </div>
    </main>
  );
}
