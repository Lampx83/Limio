import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import LanguageLeftMenu from "@/components/LanguageLeftMenu";
import { getActiveRole } from "@/lib/active-role";
import { languageShellRole } from "@/lib/languageMenu";
import { getLanguageTeacherBadges } from "@/lib/languageBadges";

export const dynamic = "force-dynamic";

/**
 * LANG L1/L2 — khu Limio Language. Khách (chưa đăng nhập) chỉ thấy trang giới thiệu, không có menu; người đã
 * đăng nhập có menu theo vai đang chọn. Trang giới thiệu có thể được index; phần theo vai là riêng tư
 * (từng trang tự đặt `NOINDEX`).
 */
export async function generateMetadata(): Promise<Metadata> {
  return { title: "Limio Language" };
}

export default async function LanguageLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) return <>{children}</>;
  const role = languageShellRole(getActiveRole(session.user.roles ?? []));
  return (
    <div className="flex w-full">
      <LanguageLeftMenu role={role} badges={role === "teacher" ? await getLanguageTeacherBadges(session.user.id) : {}} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
