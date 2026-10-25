import type { Prisma, PrismaClient } from "@feedbackme/db";

/**
 * Quyền với một bài giảng Limio-Live (docs/tieu-chi/dong-giang-vien-bai-giang.md): CHỦ bài (`LiveDeck.userId`) hoặc ĐỒNG GIẢNG VIÊN
 * (bảng LiveDeckCollaborator). Đồng giảng viên soạn, chỉnh bằng AI, chiếu, xem lịch sử phiên của chính mình, nhân bản; chỉ chủ bài
 * xoá, chia sẻ qua link, đổi nhóm và thêm/gỡ người. Mọi chỗ kiểm quyền bài giảng đều đi qua các hàm ở đây, không tự so `userId`.
 */

/** Điều kiện lọc bài giảng mà người này có quyền soạn (chủ hoặc đồng giảng viên). */
export const deckAccessWhere = (userId: string): Prisma.LiveDeckWhereInput => ({
  OR: [{ userId }, { collaborators: { some: { userId } } }],
});

/** Người này có quyền soạn bài giảng không. `deck` cần có id và userId của chủ. */
export async function hasDeckAccess(deck: { id: string; userId: string }, userId: string, db: PrismaClient): Promise<boolean> {
  if (deck.userId === userId) return true;
  const row = await db.liveDeckCollaborator.findUnique({ where: { deckId_userId: { deckId: deck.id, userId } }, select: { userId: true } });
  return !!row;
}
