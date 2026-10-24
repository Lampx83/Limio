import { Suspense } from "react";
import { getOrgCalendarContext } from "@feedbackme/core-lms";
import { toDayKey } from "@/lib/datetime";
import {
  loadInstructorCalendarAssignments,
  loadInstructorCalendarMeetings,
  loadLearnerCalendarAssignments,
  loadLearnerCalendarMeetings,
} from "@/lib/calendarData";
import WorkspaceCalendar from "./WorkspaceCalendar";

async function CalendarInner({
  userId,
  audience,
  defaultView,
}: {
  userId: string;
  /** learner: hạn nộp của bài mình phải làm; instructor: hạn nộp bài của các khoá mình dạy. */
  audience: "learner" | "instructor";
  defaultView?: "week" | "month";
}) {
  const now = new Date();
  const [ctx, assignments, meetings] = await Promise.all([
    getOrgCalendarContext(userId),
    audience === "learner"
      ? loadLearnerCalendarAssignments(userId, now)
      : loadInstructorCalendarAssignments(userId, now),
    // Buổi học của lớp có lịch (CENTER). Lỗi ở đây không được làm hỏng cả lịch hạn nộp.
    (audience === "learner" ? loadLearnerCalendarMeetings(userId, now) : loadInstructorCalendarMeetings(userId, now)).catch(() => []),
  ]);
  return (
    <WorkspaceCalendar
      todayKey={toDayKey(now)}
      organizationName={ctx.organization?.name ?? null}
      terms={ctx.terms}
      assignments={[...assignments, ...meetings]}
      defaultView={defaultView}
    />
  );
}

/**
 * Lịch cho dashboard. Bọc Suspense để truy vấn lịch không chặn phần còn lại của
 * trang (dashboard vốn đã nhiều truy vấn nặng).
 */
export default function CalendarLoader(props: { userId: string; audience: "learner" | "instructor"; defaultView?: "week" | "month" }) {
  return (
    <Suspense fallback={<div className="card h-40 animate-pulse" aria-hidden />}>
      <CalendarInner {...props} />
    </Suspense>
  );
}
