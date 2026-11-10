/** Các mục menu giảng viên thuộc tính năng trung tâm: ẩn khi tài khoản chưa được bật (xem core-lms/org/centerAccess.ts). */
export const CENTER_INSTRUCTOR_HREFS: ReadonlySet<string> = new Set(["/instructor/lich-day", "/instructor/giao-trinh"]);
/** Mục menu học viên "Lịch học": ẩn khi học viên chưa học ở lớp nào có lịch. */
export const CENTER_LEARNER_HREF = "/me/lich-hoc";
/**
 * Mục menu học viên "Mục tiêu": hiện khi học viên học ở lớp có lịch HOẶC đang có một mục tiêu đang theo đuổi
 * (docs/tieu-chi/limio-language-gop-menu.md, AC2b) — nên không còn nằm chung nhóm với "Lịch học".
 */
export const LEARNER_GOALS_HREF = "/me/muc-tieu";

/** Mục menu mà giảng viên trung tâm (chỉ dạy) được thấy; mọi mục soạn nội dung đều ẩn. */
export const TEACHING_ONLY_HREFS: ReadonlySet<string> = new Set([
  "/instructor/lich-day",
  "/instructor/assignments",
  "/instructor/forum",
]);
