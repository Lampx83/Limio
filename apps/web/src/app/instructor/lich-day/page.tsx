import { redirect } from "next/navigation";
import { listTeacherMeetings, addDays } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import ScheduleWeek, { todayKey, weekStartOf } from "@/components/ScheduleWeek";

export const dynamic = "force-dynamic";

export default async function LichDayPage({ searchParams }: { searchParams: { tuan?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/lich-day");

  const given = searchParams.tuan && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.tuan) ? searchParams.tuan : null;
  const weekStart = weekStartOf(given ?? todayKey());
  const meetings = await listTeacherMeetings(session.user.id, { from: weekStart, to: addDays(weekStart, 6) });

  return (
    <main>
      <h1 className="text-h1">Lịch dạy</h1>
      <p className="mt-1 text-sm text-muted">
        Các buổi của mọi lớp thuộc khoá thầy/cô đang dạy. Bấm một buổi để điểm danh. Đặt lịch cho từng lớp ở trang lớp trong khoá học.
      </p>
      <div className="mt-6">
        <ScheduleWeek
          weekStart={weekStart}
          meetings={meetings}
          basePath="/instructor/lich-day"
          hrefFor={(m) =>
            m.status === "cancelled"
              ? `/instructor/courses/${m.courseId}/sections/${m.sectionId}`
              : `/instructor/courses/${m.courseId}/sections/${m.sectionId}/meetings/${m.id}`
          }
        />
      </div>
    </main>
  );
}
