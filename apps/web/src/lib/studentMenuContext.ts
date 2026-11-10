import { getLearnerCenterAccess, getLearnerGoalsAccess } from "./centerAccess";
import { getStudentMenuBadges, getStudentMenuContinue, type MenuBadge, type MenuContinue } from "./studentMenuBadges";

export interface StudentMenuContext {
  badges: Record<string, MenuBadge>;
  continueTo: MenuContinue | null;
  /** Học viên đang học ở lớp có lịch → hiện "Lịch học". */
  showSchedule: boolean;
  /** Học ở lớp có lịch HOẶC đang có mục tiêu → hiện "Mục tiêu" (AC2b). */
  showGoals: boolean;
}

const EMPTY: StudentMenuContext = { badges: {}, continueTo: null, showSchedule: false, showGoals: false };

/**
 * Dữ liệu menu trái học viên — MỘT nơi cho cả ba chỗ gắn (`app/me`, `app/learn/[slug]`, `app/language`), để menu không
 * lệch nhau (trước đây ngăn kéo ở trang bài học quên truyền `showSchedule`). Lỗi ở một điều kiện phụ coi như điều kiện đó
 * tắt: menu không được hỏng vì một truy vấn phụ.
 */
export async function getStudentMenuContext(userId: string | undefined): Promise<StudentMenuContext> {
  if (!userId) return EMPTY;
  const [badges, continueTo, showSchedule, showGoals] = await Promise.all([
    getStudentMenuBadges(userId).catch(() => EMPTY.badges),
    getStudentMenuContinue(userId).catch(() => null),
    getLearnerCenterAccess(userId).catch(() => false),
    getLearnerGoalsAccess(userId).catch(() => false),
  ]);
  return { badges, continueTo, showSchedule, showGoals };
}
