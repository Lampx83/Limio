import type { TabKey } from "@/components/lesson/LessonTabs";

export interface BottomTab {
  key: TabKey;
  label: string;
  icon: string;
  count: number;
}

/**
 * Khối hai tab "Bài tập" / "Thảo luận" ở cuối bài học (docs/tieu-chi/limio-language-y-kien-hoc-vien-giao-dien.md, AC1).
 *
 * Khoá thường: luôn cả hai tab. Khoá ngoại ngữ (giáo trình): chỉ tab nào đã **có** dữ liệu — bài tập giao, hoặc chủ đề
 * thảo luận — và không có tab nào thì cả khối biến mất. Không xoá hay giấu dữ liệu đã có.
 */
export function lessonBottomTabs(input: {
  languageMode: boolean;
  tasksCount: number;
  tasksUndone: number;
  threadsCount: number;
}): { tabs: BottomTab[]; defaultTab: TabKey } {
  const { languageMode, tasksCount, tasksUndone, threadsCount } = input;
  const tabs: BottomTab[] = [];
  if (!languageMode || tasksCount > 0) tabs.push({ key: "tasks", label: "Bài tập", icon: "📝", count: tasksUndone });
  if (!languageMode || threadsCount > 0) tabs.push({ key: "forum", label: "Thảo luận", icon: "💬", count: threadsCount });
  const wanted: TabKey = tasksUndone > 0 ? "tasks" : "forum";
  const defaultTab = tabs.some((t) => t.key === wanted) ? wanted : (tabs[0]?.key ?? wanted);
  return { tabs, defaultTab };
}
