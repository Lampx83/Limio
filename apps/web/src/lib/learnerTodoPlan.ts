import { daysBetweenKeys } from "@feedbackme/shared-types";

/** Một việc học viên còn phải làm (bài tập/quiz chưa nộp). Đủ nhẹ để đi từ server xuống client. */
export interface TodoItem {
  id: string;
  kind: "assignment" | "quiz";
  title: string;
  courseTitle: string;
  href: string;
  /** YYYY-MM-DD giờ VN; null = không có hạn. */
  dueDay: string | null;
  /** HH:mm giờ VN; null khi không có hạn. */
  dueTime: string | null;
  /** Đã quá hạn tại thời điểm server dựng trang (chính xác đến phút, không chỉ theo ngày). */
  overdue: boolean;
  /** Quiz có lượt làm dở. */
  inProgress?: boolean;
}

export const TODO_TOP_N = 5;
/** ≤ số ngày này (chưa quá hạn) tính là "sắp hết hạn". */
export const TODO_URGENT_DAYS = 3;
/** Quá hạn NHIỀU HƠN số ngày này thì tự rời khỏi top (không có nút ẩn thủ công). */
export const TODO_AUTO_HIDE_AFTER_DAYS = 7;

export interface TodoStats {
  total: number;
  overdue: number;
  urgent: number;
  later: number;
  noDue: number;
  /** Số việc quá hạn hơn TODO_AUTO_HIDE_AFTER_DAYS ngày, tự ẩn khỏi top. */
  autoHidden: number;
}

export interface TodoPlan {
  /** Top việc có hạn: hạn gần nhất trước, không gồm việc quá hạn hơn 1 tuần. */
  top: TodoItem[];
  /** Việc không có hạn (khu riêng). */
  noDue: TodoItem[];
  /** Toàn bộ, thứ tự hiển thị: có hạn (gần → xa) rồi không hạn. Gồm cả việc đã tự ẩn khỏi top. */
  all: TodoItem[];
  stats: TodoStats;
}

const dueKey = (i: TodoItem) => `${i.dueDay}T${i.dueTime}`;

/** Quá hạn hơn TODO_AUTO_HIDE_AFTER_DAYS ngày (tính theo ngày lịch VN) → tự ẩn khỏi top. */
export function isAutoHidden(item: TodoItem, todayKey: string): boolean {
  return item.overdue && item.dueDay !== null && daysBetweenKeys(item.dueDay, todayKey) > TODO_AUTO_HIDE_AFTER_DAYS;
}

/**
 * Xếp việc cần làm.
 *
 * Việc quá hạn nằm đầu vì "còn ít ngày nhất" (âm) — đó là việc gấp nhất. Quá hạn HƠN 1 tuần thì
 * tự rời khỏi top (đã quá muộn để coi là "ưu tiên"); không có ẩn thủ công, nên kết quả chỉ phụ thuộc
 * dữ liệu và ngày hôm nay — giống nhau ở mọi thiết bị. Việc đó vẫn nằm trong `all` (danh sách đầy đủ)
 * và trong số liệu "quá hạn" vì học viên thực sự chưa nộp.
 */
export function buildTodoPlan(items: readonly TodoItem[], todayKey: string): TodoPlan {
  const withDue = items.filter((i) => i.dueDay !== null).sort((a, b) => dueKey(a).localeCompare(dueKey(b)));
  const noDue = items
    .filter((i) => i.dueDay === null)
    .sort((a, b) => a.courseTitle.localeCompare(b.courseTitle) || a.title.localeCompare(b.title));

  const isAuto = (i: TodoItem) => isAutoHidden(i, todayKey);
  const top = withDue.filter((i) => !isAuto(i)).slice(0, TODO_TOP_N);

  let overdue = 0;
  let urgent = 0;
  let later = 0;
  for (const i of withDue) {
    if (i.overdue) overdue++;
    else if (daysBetweenKeys(todayKey, i.dueDay!) <= TODO_URGENT_DAYS) urgent++;
    else later++;
  }

  return {
    top,
    noDue,
    all: [...withDue, ...noDue],
    stats: {
      total: items.length,
      overdue,
      urgent,
      later,
      noDue: noDue.length,
      autoHidden: withDue.filter(isAuto).length,
    },
  };
}

/** "Quá hạn 2 ngày" / "Hôm nay 20:00" / "Ngày mai 12:00" / "Còn 5 ngày · 05/10". */
export function describeDue(item: TodoItem, todayKey: string): string {
  if (item.dueDay === null || item.dueTime === null) return "Không có hạn";
  const days = daysBetweenKeys(todayKey, item.dueDay);
  const dm = `${item.dueDay.slice(8, 10)}/${item.dueDay.slice(5, 7)}`;
  if (item.overdue) return days >= 0 ? `Quá hạn hôm nay ${item.dueTime}` : `Quá hạn ${-days} ngày`;
  if (days === 0) return `Hôm nay ${item.dueTime}`;
  if (days === 1) return `Ngày mai ${item.dueTime}`;
  return `Còn ${days} ngày · ${dm}`;
}

/** Cắt mảng thành trang (1-based); page ngoài khoảng được kẹp lại. */
export function paginate<T>(list: readonly T[], page: number, pageSize: number): { rows: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  const p = Math.min(Math.max(1, page), pages);
  return { rows: list.slice((p - 1) * pageSize, p * pageSize), page: p, pages };
}
