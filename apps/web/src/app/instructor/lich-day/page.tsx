import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getInstructorCenterAccess } from "@/lib/centerAccess";
import MeetingsCalendar from "@/components/calendar/MeetingsCalendar";

export const dynamic = "force-dynamic";

export default async function LichDayPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/lich-day");
  if (!(await getInstructorCenterAccess(session.user.id))) redirect("/instructor/dashboard");

  return (
    <main>
      <h1 className="text-h1">Lịch dạy</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Các buổi của mọi lớp thuộc khoá thầy/cô đang dạy. Bấm một ngày để xem các buổi trong ngày, bấm một buổi để điểm danh. Đặt lịch
        cho từng lớp ở trang lớp trong khoá học.
      </p>
      <p className="mt-2 text-sm">
        <Link href="/instructor/doi-chieu" className="font-medium text-lime-700 hover:underline dark:text-lime-400">
          Đối chiếu lịch dạy của tôi →
        </Link>
      </p>
      <div className="mt-6 max-w-3xl">
        <MeetingsCalendar userId={session.user.id} audience="instructor" />
      </div>
    </main>
  );
}
