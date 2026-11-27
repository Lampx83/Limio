import { isAnyOrgAdmin, listPublisherCourses, listPublisherOrgs, type PublisherCourseRow, type PublisherOrgRow } from "@feedbackme/core-lms";

export type PublisherArea =
  | { state: "forbidden" }
  | { state: "no_publisher"; anyAdminship: boolean }
  | { state: "ok"; orgs: PublisherOrgRow[]; org: PublisherOrgRow; courses: PublisherCourseRow[]; course: PublisherCourseRow | null };

/**
 * Bối cảnh của các trang khu nhà xuất bản trong /org-admin: nhà xuất bản đang chọn (`?truong=`, mặc định cái đầu) và khoá đang chọn (`?khoa=`).
 * Quyền kiểm ở `listPublisherOrgs`/`listPublisherCourses` (lõi), trang chỉ chọn cái hiện.
 */
export async function loadPublisherArea(userId: string, q: { truong?: string; khoa?: string }): Promise<PublisherArea> {
  if (!(await isAnyOrgAdmin(userId))) return { state: "forbidden" };
  const orgs = await listPublisherOrgs(userId);
  if (orgs.length === 0) return { state: "no_publisher", anyAdminship: true };
  const org = orgs.find((o) => o.id === q.truong) ?? orgs[0]!;
  const courses = await listPublisherCourses(userId, org.id);
  const course = courses.find((c) => c.id === q.khoa) ?? courses[0] ?? null;
  return { state: "ok", orgs, org, courses, course };
}
