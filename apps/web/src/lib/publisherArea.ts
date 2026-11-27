import { getActiveOrg } from "@/lib/activeOrg";
import { isAnyOrgAdmin, listPublisherCourses, listPublisherOrgs, type PublisherCourseRow, type PublisherOrgRow } from "@feedbackme/core-lms";

export type PublisherArea =
  | { state: "forbidden" }
  | { state: "no_publisher"; anyAdminship: boolean }
  | { state: "ok"; orgs: PublisherOrgRow[]; org: PublisherOrgRow; courses: PublisherCourseRow[]; course: PublisherCourseRow | null };

/**
 * Bối cảnh của các trang khu nhà xuất bản trong /org-admin: nhà xuất bản đang chọn (tổ chức đang chọn của khu quản trị) và khoá đang chọn (`?khoa=`).
 * Quyền kiểm ở `listPublisherOrgs`/`listPublisherCourses` (lõi), trang chỉ chọn cái hiện.
 */
export async function loadPublisherArea(userId: string, q: { truong?: string; khoa?: string }): Promise<PublisherArea> {
  if (!(await isAnyOrgAdmin(userId))) return { state: "forbidden" };
  // Khu quản trị làm việc với MỘT tổ chức đang chọn: chỉ nhà xuất bản đó (chọn ở màn "Chọn tổ chức để quản trị").
  const active = await getActiveOrg(userId);
  const orgs = (await listPublisherOrgs(userId)).filter((o) => !active || o.id === active.id);
  if (orgs.length === 0) return { state: "no_publisher", anyAdminship: true };
  const org = orgs.find((o) => o.id === q.truong) ?? orgs[0]!;
  const courses = await listPublisherCourses(userId, org.id);
  const course = courses.find((c) => c.id === q.khoa) ?? courses[0] ?? null;
  return { state: "ok", orgs, org, courses, course };
}
