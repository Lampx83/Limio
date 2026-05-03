import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function InstitutionAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "institution_admin") redirect("/");
  if (user.institution_id === null) redirect("/");
  return <>{children}</>;
}
