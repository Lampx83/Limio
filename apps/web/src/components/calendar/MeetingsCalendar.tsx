import { Suspense } from "react";
import { getOrgCalendarContext } from "@feedbackme/core-lms";
import { toDayKey } from "@/lib/datetime";
import { loadInstructorCalendarMeetings, loadLearnerCalendarMeetings } from "@/lib/calendarData";
import WorkspaceCalendar from "./WorkspaceCalendar";

// Trang riêng nên lấy cửa sổ rộng hơn widget ở trang chủ: lật được vài tháng mà không phải tải lại.
const WINDOW = { pastDays: 60, futureDays: 300 };

async function Inner({ userId, audience }: { userId: string; audience: "learner" | "instructor" }) {
  const now = new Date();
  const [ctx, items] = await Promise.all([
    getOrgCalendarContext(userId),
    audience === "learner"
      ? loadLearnerCalendarMeetings(userId, now, WINDOW)
      : loadInstructorCalendarMeetings(userId, now, WINDOW),
  ]);
  return (
    <WorkspaceCalendar
      todayKey={toDayKey(now)}
      organizationName={ctx.organization?.name ?? null}
      terms={ctx.terms}
      assignments={items}
      defaultView="month"
      labels={{ empty: "Không có buổi học ngày này.", next: "Buổi học tiếp theo:" }}
    />
  );
}

/** Lịch buổi học dạng lịch (cùng giao diện với widget "Lịch" ở trang chủ), cho trang "Lịch dạy" và "Lịch học". */
export default function MeetingsCalendar(props: { userId: string; audience: "learner" | "instructor" }) {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse" aria-hidden />}>
      <Inner {...props} />
    </Suspense>
  );
}
