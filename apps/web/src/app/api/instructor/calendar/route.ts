import { getOrgCalendarContext } from "@feedbackme/core-lms";
import { requireInstructor } from "@/lib/session";
import { toDayKey } from "@/lib/datetime";
import { loadInstructorCalendarAssignments } from "@/lib/calendarData";

export const runtime = "nodejs";

/**
 * GET /api/instructor/calendar
 * Dữ liệu cho lịch ở thanh đầu trang giảng viên (hạn nộp bài tập và bài kiểm tra của các khoá mình dạy, kỳ học của
 * trường nếu có). Tải khi giảng viên bấm nút lịch chứ không kèm theo mọi lần dựng trang, vì thanh đầu trang có mặt ở
 * mọi trang. Trả { todayKey, organizationName, terms, assignments }.
 */
export async function GET() {
  const userId = await requireInstructor();
  if (!userId) return Response.json({ error: "forbidden" }, { status: 403 });

  const now = new Date();
  const [ctx, assignments] = await Promise.all([
    getOrgCalendarContext(userId),
    loadInstructorCalendarAssignments(userId, now),
  ]);
  return Response.json(
    { todayKey: toDayKey(now), organizationName: ctx.organization?.name ?? null, terms: ctx.terms, assignments },
    { headers: { "cache-control": "private, no-store" } },
  );
}
