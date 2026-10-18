import { prisma } from "@feedbackme/db";

/**
 * Tên đơn vị và tên người trình bày để điền sẵn vào slide bìa (fillCoverIdentity): lấy từ tên trường của giảng viên
 * và tên hiển thị trong hồ sơ. Giảng viên chưa thuộc trường nào thì để trống tên đơn vị; không bao giờ để AI viết.
 */
export async function coverIdentityFor(userId: string): Promise<{ org: string; presenter: string }> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, organization: { select: { name: true } } },
  });
  return { org: u?.organization?.name?.trim() ?? "", presenter: u?.displayName?.trim() ?? "" };
}
