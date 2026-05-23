import { auth } from "@/lib/auth";
import StudentLeftMenu from "@/components/StudentLeftMenu";
import { getStudentMenuBadges } from "@/lib/studentMenuBadges";

export default async function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return <>{children}</>;
  }
  const badges = await getStudentMenuBadges(session.user.id);
  return (
    <div className="flex w-full">
      <StudentLeftMenu badges={badges} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
