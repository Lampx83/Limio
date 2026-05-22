import { auth } from "@/lib/auth";
import StudentLeftMenu from "@/components/StudentLeftMenu";
import { getStudentMenuBadges } from "@/lib/studentMenuBadges";

export default async function MeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const badges = await getStudentMenuBadges(session?.user?.id);
  return (
    <div className="flex w-full">
      <StudentLeftMenu badges={badges} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
