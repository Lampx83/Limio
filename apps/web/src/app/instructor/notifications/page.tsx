import NotificationsPage from "@/app/me/notifications/page";

export const dynamic = "force-dynamic";

// Instructor-side entry point — shares the same UI but locks the role to
// "instructor" regardless of cookie. Convenient deep-link from the bell's
// "Xem tất cả" when the user is currently in instructor mode.
export default function InstructorNotificationsPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  return NotificationsPage({ searchParams, forceRole: "instructor" });
}
