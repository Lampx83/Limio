import { auth } from "@/lib/auth";
import StudentLeftMenu from "@/components/StudentLeftMenu";
import { getStudentMenuBadges, getStudentMenuContinue } from "@/lib/studentMenuBadges";

export default async function TournamentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return <>{children}</>;
  }
  const [badges, continueTo] = await Promise.all([
    getStudentMenuBadges(session.user.id),
    getStudentMenuContinue(session.user.id),
  ]);
  return (
    <div className="flex w-full">
      <StudentLeftMenu badges={badges} continueTo={continueTo} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
