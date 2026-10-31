import type { Prisma } from "@feedbackme/db";

/**
 * Sự kiện nào KHÔNG phải do học viên học. `attendance.student.marked` có subject là học viên
 * (để Feedback Engine và Gamification đọc theo người) nhưng là giáo viên bấm; nếu được tính là
 * hoạt động thì lớp học viên vắng mặt vẫn "mới hoạt động hôm qua" và lọt khỏi danh sách bỏ bê.
 * `class.*`, `course.pack.*` và `meeting.*` (tổng kết, nhận xét) do giảng viên thao tác; `goal.*` là đặt kế hoạch, không phải học; `lesson.deck.*` là gắn bài giảng slide vào bài học. Thêm namespace sự kiện kiểu này thì thêm vào đây.
 */
export const NON_LEARNER_ACTIVITY_PREFIXES = ["attendance.", "class.", "course.pack.", "course.protected_media.", "meeting.", "goal.", "lesson.deck."] as const;

export function isLearnerActivityType(eventType: string): boolean {
  return !NON_LEARNER_ACTIVITY_PREFIXES.some((p) => eventType.startsWith(p));
}

/**
 * Điều kiện gộp vào `where` của mọi truy vấn "lần hoạt động gần nhất" / "có hoạt động trong N ngày":
 * `where: { userId, courseId, ...learnerActivityWhere() }`.
 */
export function learnerActivityWhere(): Prisma.LearningEventWhereInput {
  return { NOT: NON_LEARNER_ACTIVITY_PREFIXES.map((p) => ({ eventType: { startsWith: p } })) };
}
