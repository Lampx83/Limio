import Link from "next/link";
import { redirect } from "next/navigation";
import { RoleName } from "@feedbackme/shared-types";
import { auth } from "@/lib/auth";
import LandingPage from "@/components/LandingPage";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Logged-in users → role-appropriate dashboard. Default ưu tiên Instructor
  // (đa số task hằng ngày là dạy học), Admin chỉ là landing khi user thuần
  // admin — admin kiêm instructor sẽ vào /instructor/dashboard và tự nav sang
  // /admin/dashboard khi cần. Learner > Instructor > Admin fallback chain.
  const session = await auth();
  if (session?.user?.id) {
    const roles = session.user.roles ?? [];
    if (roles.includes(RoleName.Instructor)) redirect("/instructor/dashboard");
    if (roles.includes(RoleName.Admin)) redirect("/admin/dashboard");
    redirect("/me/dashboard");
  }

  return <LandingPage />;
}
