import { Suspense } from "react";
import { getOrgCalendarContext } from "@feedbackme/core-lms";
import { toDayKey } from "@/lib/datetime";
import { loadInstructorCalendarAssignments, loadLearnerCalendarAssignments } from "@/lib/calendarData";
import WorkspaceCalendar from "./WorkspaceCalendar";

async function CalendarInner({
  userId,
  audience,
}: {
  userId: string;
  /** learner: hạn nộp của bài mình phải làm; instructor: hạn nộp bài của các khoá mình dạy. */
  audience: "learner" | "instructor";
}) {
  const now = new Date();
  const [ctx, assignments] = await Promise.all([
    getOrgCalendarContext(userId),
    audience === "learner"
      ? loadLearnerCalendarAssignments(userId, now)
      : loadInstructorCalendarAssignments(userId, now),
  ]);
  return (
    <WorkspaceCalendar
      todayKey={toDayKey(now)}
      organizationName={ctx.organization?.name ?? null}
      terms={ctx.terms}
      assignments={assignments}
    />
  );
}

/**
 * Lịch cho dashboard. Bọc Suspense để truy vấn lịch không chặn phần còn lại của
 * trang (dashboard vốn đã nhiều truy vấn nặng).
 */
export default function CalendarLoader(props: { userId: string; audience: "learner" | "instructor" }) {
  return (
    <Suspense fallback={<div className="card h-40 animate-pulse" aria-hidden />}>
      <CalendarInner {...props} />
    </Suspense>
  );
}
