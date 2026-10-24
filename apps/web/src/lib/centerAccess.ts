import { unstable_cache, revalidateTag } from "next/cache";
import { hasClassSchedule, isCenterEnabledForUser } from "@feedbackme/core-lms";

export { CENTER_INSTRUCTOR_HREFS, CENTER_LEARNER_HREF, CENTER_LEARNER_HREFS, TEACHING_ONLY_HREFS } from "./centerAccess.constants";

const TAG = "center-access";

/**
 * Menu và trang gọi hàm này ở MỌI lượt chuyển trang, nên cache ngắn theo người dùng. Khi bật/tắt cho trường,
 * route đổi công tắc gọi `revalidateCenterAccess()` để áp ngay.
 */
export const getInstructorCenterAccess = unstable_cache(
  async (userId: string) => isCenterEnabledForUser(userId),
  ["center-access-instructor"],
  { revalidate: 30, tags: [TAG] },
);

export const getLearnerCenterAccess = unstable_cache(
  async (userId: string) => hasClassSchedule(userId),
  ["center-access-learner"],
  { revalidate: 30, tags: [TAG] },
);

export function revalidateCenterAccess() {
  revalidateTag(TAG);
}
