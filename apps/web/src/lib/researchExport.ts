import { createHash } from "node:crypto";
import { prisma } from "@feedbackme/db";

/**
 * B13 — phần dùng chung của ba báo cáo nghiên cứu.
 *
 * Mọi báo cáo phân tích đang có đều gom theo khoá học và không có cột lớp, nên
 * không so sánh được hai lớp song song của cùng một khoá — đúng thứ cần cho
 * thực nghiệm về phản hồi cá nhân hoá. `LearningEvent` cũng không có cột nào
 * trỏ tới lớp; đường duy nhất là `Enrollment` (mỗi người đúng một lớp trong
 * một khoá), nên bảng tra dưới đây được dựng một lần rồi dùng lại.
 */

export interface LearnerRef {
  sectionName: string;
  feedbackVariant: "personalized" | "minimal";
  email: string;
  displayName: string;
  anonId: string;
}

/**
 * Mã ẩn danh ổn định cho một người học trong một khoá.
 *
 * Băm kèm courseId chứ không băm riêng userId: cùng một sinh viên học hai
 * khoá sẽ có hai mã khác nhau, nên ghép hai bộ dữ liệu đã ẩn danh lại cũng
 * không lần ra được người. Mười hai ký tự là đủ để không đụng nhau ở quy mô
 * một trường, và đủ ngắn để đọc trong bảng tính.
 */
export function anonId(userId: string, courseId: string): string {
  return createHash("sha256").update(`${courseId}:${userId}`).digest("hex").slice(0, 12);
}

/** userId → lớp, điều kiện thực nghiệm và danh tính, cho cả khoá. */
export async function learnerIndex(
  courseId: string,
): Promise<Map<string, LearnerRef>> {
  const rows = await prisma.enrollment.findMany({
    where: { courseId },
    select: {
      userId: true,
      section: { select: { name: true, feedbackVariant: true, isDefault: true } },
      user: { select: { email: true, displayName: true } },
    },
  });

  const map = new Map<string, LearnerRef>();
  for (const r of rows) {
    map.set(r.userId, {
      // Lớp mặc định không phải một lớp thật — người rơi vào đó không thuộc
      // nhóm thực nghiệm nào, và gọi tên nó ra sẽ đỡ bị đếm nhầm vào một nhánh.
      sectionName: r.section.isDefault ? "(chưa gán lớp)" : r.section.name,
      feedbackVariant: r.section.feedbackVariant,
      email: r.user.email,
      displayName: r.user.displayName ?? "",
      anonId: anonId(r.userId, courseId),
    });
  }
  return map;
}

/** Bốn cột định danh đứng đầu mọi báo cáo, để ghép file bằng cột nào cũng được. */
export function identityCols(ref: LearnerRef | undefined) {
  return {
    "Mã ẩn danh": ref?.anonId ?? "",
    Lớp: ref?.sectionName ?? "",
    "Điều kiện": ref ? VARIANT_LABEL[ref.feedbackVariant] : "",
    Email: ref?.email ?? "",
    "Họ tên": ref?.displayName ?? "",
  };
}

export const VARIANT_LABEL: Record<"personalized" | "minimal", string> = {
  personalized: "Cá nhân hoá",
  minimal: "Rút gọn (đối chứng)",
};
