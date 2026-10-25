/**
 * Tab của trang lớp (`/instructor/courses/[id]/sections/[sectionId]?tab=…`). Chỉ có khi khoá dùng tính năng trung tâm:
 * "Lịch dạy" (đặt lịch, các buổi) và "Học viên" (chuyên cần, mục tiêu, danh sách). Khoá không dùng thì trang chỉ là danh sách
 * học viên như trước, không có tab.
 */
export const SECTION_TABS = [
  { id: "lich-day", label: "Lịch dạy" },
  { id: "hoc-vien", label: "Học viên" },
] as const;

export type SectionTabId = (typeof SECTION_TABS)[number]["id"];

export function resolveSectionTab(raw: string | string[] | undefined, centerEnabled: boolean): SectionTabId {
  if (!centerEnabled) return "hoc-vien";
  return raw === "hoc-vien" ? "hoc-vien" : "lich-day";
}
