import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import LanguageLeftMenu from "@/components/LanguageLeftMenu";
import { getActiveRole } from "@/lib/active-role";
import { languageShellIsLearner } from "@/lib/languageMenu";

export const dynamic = "force-dynamic";

/**
 * LANG L1/L2 — khu Limio Language (đợt 1: học viên). Khách (chưa đăng nhập) chỉ thấy trang giới thiệu, không có menu;
 * học viên đã đăng nhập có menu "Không gian học". Trang giới thiệu có thể được index; phần theo người dùng là riêng
 * tư (từng trang tự đặt `NOINDEX`). Giảng viên/admin được trang chủ chuyển về khu của họ nên không có menu ở đây.
 */
export async function generateMetadata(): Promise<Metadata> {
  return { title: "Limio Language" };
}

export default async function LanguageLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id || !languageShellIsLearner(getActiveRole(session.user.roles ?? []))) return <>{children}</>;
  return (
    <div className="flex w-full">
      <LanguageLeftMenu />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
