import { redirect } from "next/navigation";
import { listLearnerMeetings, addDays } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import ScheduleWeek, { todayKey, weekStartOf } from "@/components/ScheduleWeek";

export const dynamic = "force-dynamic";

export default async function LichHocPage({ searchParams }: { searchParams: { tuan?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/me/lich-hoc");

  const given = searchParams.tuan && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.tuan) ? searchParams.tuan : null;
  const weekStart = weekStartOf(given ?? todayKey());
  const meetings = await listLearnerMeetings(session.user.id, { from: weekStart, to: addDays(weekStart, 6) });

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      <h1 className="text-h1">Lịch học</h1>
      <p className="mt-1 text-sm text-muted">Các buổi học của những lớp bạn đang tham gia.</p>
      <div className="mt-6">
        <ScheduleWeek weekStart={weekStart} meetings={meetings} basePath="/me/lich-hoc" />
      </div>
    </main>
  );
}
