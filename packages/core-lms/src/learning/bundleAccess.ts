import { type PrismaClient } from "@feedbackme/db";
import { extendEnrollmentAccess } from "./courseAccess";

/**
 * Cấp quyền học cho MỌI khoá của một combo khi đơn combo `paid` (docs/tieu-chi/combo-khoa-hoc.md, AC5).
 *
 * Chạy trong giao dịch của người gọi (`tx`): hoặc đủ mọi khoá hoặc không khoá nào. Mỗi khoá đi đúng đường
 * `extendEnrollmentAccess` như mua lẻ (thời hạn = durationMonths của combo, cộng dồn nếu còn hạn, vĩnh viễn nếu null).
 * Danh sách khoá lấy LÚC NÀY (thanh toán thành công), không phải lúc tạo đơn.
 */
export async function grantBundleAccess(
  userId: string,
  bundleId: string,
  tx: PrismaClient,
): Promise<{ courseIds: string[] }> {
  const bundle = await tx.courseBundle.findUniqueOrThrow({
    where: { id: bundleId },
    select: {
      durationMonths: true,
      items: { orderBy: { orderIndex: "asc" }, select: { course: { select: { id: true, version: true } } } },
    },
  });
  const plan = { id: null, durationMonths: bundle.durationMonths };
  for (const it of bundle.items) {
    await extendEnrollmentAccess(userId, it.course, plan, tx, { via: "order" });
  }
  return { courseIds: bundle.items.map((i) => i.course.id) };
}
