import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getLearnerCenterAccess } from "@/lib/centerAccess";
import MeetingsCalendar from "@/components/calendar/MeetingsCalendar";
import MyAttendanceCard from "@/components/MyAttendanceCard";

export const dynamic = "force-dynamic";

export default async function LichHocPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/me/lich-hoc");
  if (!(await getLearnerCenterAccess(session.user.id))) redirect("/me/dashboard");
  const userId = session.user.id;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      <h1 className="text-h1">Lịch học</h1>
      <p className="mt-1 text-sm text-muted">
        Các buổi học của những lớp bạn đang tham gia. Bấm một ngày để xem các buổi trong ngày; buổi đã điểm danh hiện trạng thái của bạn.
      </p>
      <div className="mt-6 space-y-6">
        <MeetingsCalendar userId={userId} audience="learner" />
        <MyAttendanceCard userId={userId} />
      </div>
    </main>
  );
}
