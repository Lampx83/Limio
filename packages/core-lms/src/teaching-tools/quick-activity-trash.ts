import { PrismaClient } from "@feedbackme/db";
import { listLiveRuntimeRefIds } from "../live/history";

/**
 * Thùng rác của "Hoạt động nhanh" (Vote, Word Cloud, Padlet/Draw-it, Whiteboard).
 *
 * Xoá trong lịch sử chỉ đặt `deletedAt`: phiên biến khỏi danh sách và học viên không vào
 * được nữa, nhưng GV còn khôi phục được trong TRASH_RETENTION_DAYS ngày. Quá hạn thì cron
 * (`purgeExpiredQuickActivities`) xoá vĩnh viễn — phiếu, bài gửi, ghi chú đi theo cascade.
 *
 * Phiên sinh từ slide Bài giảng tương tác (Limio-Live) thuộc lịch sử của bài giảng đó,
 * nên mọi hàm ở đây bỏ qua chúng (không báo lỗi, chỉ không đếm vào kết quả).
 */

export type QuickActivityKind = "poll" | "word_cloud" | "board" | "whiteboard";

export const QUICK_ACTIVITY_KINDS: QuickActivityKind[] = ["poll", "word_cloud", "board", "whiteboard"];

export const TRASH_RETENTION_DAYS = 30;

/** Giới hạn mỗi lần thao tác, để một request không khoá cả bảng. */
export const TRASH_BATCH_LIMIT = 200;

const DAY_MS = 24 * 60 * 60 * 1000;

function assertBatch(ids: string[]): string[] {
  const unique = [...new Set(ids)];
  if (unique.length > TRASH_BATCH_LIMIT) {
    throw new Error(`Too many items (max ${TRASH_BATCH_LIMIT})`);
  }
  return unique;
}

/**
 * Điều kiện "phiên Hoạt động nhanh của user này" cho từng loại.
 * Poll/word cloud nối với Limio-Live qua ClassroomSession; bảng và whiteboard thì không
 * có khoá nối nên loại bằng danh sách id runtime (giống các route lịch sử).
 */
async function ownedWhere(kind: QuickActivityKind, ids: string[], userId: string, db: PrismaClient) {
  if (kind === "poll" || kind === "word_cloud") {
    return { id: { in: ids }, createdById: userId, session: { liveSessions: { none: {} } } };
  }
  const liveRefIds = new Set(await listLiveRuntimeRefIds(userId, db));
  return { id: { in: ids.filter((id) => !liveRefIds.has(id)) }, ownerId: userId };
}

/** Chuyển phiên vào thùng rác. Bảng/whiteboard đang mở được đóng luôn để học viên không ghi thêm. */
export async function moveQuickActivitiesToTrash(
  kind: QuickActivityKind,
  ids: string[],
  userId: string,
  db: PrismaClient,
  now: Date = new Date()
): Promise<{ count: number }> {
  const batch = assertBatch(ids);
  if (batch.length === 0) return { count: 0 };
  const where = { ...(await ownedWhere(kind, batch, userId, db)), deletedAt: null };

  switch (kind) {
    case "poll":
      return db.classroomPoll.updateMany({ where, data: { deletedAt: now } });
    case "word_cloud":
      return db.wordCloud.updateMany({ where, data: { deletedAt: now } });
    case "board":
      return db.$transaction(async (tx) => {
        await tx.interactiveBoard.updateMany({ where: { ...where, closedAt: null }, data: { closedAt: now } });
        return tx.interactiveBoard.updateMany({ where, data: { deletedAt: now, status: "closed" } });
      });
    case "whiteboard":
      return db.$transaction(async (tx) => {
        await tx.whiteboard.updateMany({ where: { ...where, closedAt: null }, data: { closedAt: now } });
        return tx.whiteboard.updateMany({ where, data: { deletedAt: now, status: "closed" } });
      });
  }
}

/** Lấy phiên ra khỏi thùng rác. Bảng/whiteboard vẫn ở trạng thái đã đóng — GV tự mở lại nếu cần. */
export async function restoreQuickActivities(
  kind: QuickActivityKind,
  ids: string[],
  userId: string,
  db: PrismaClient
): Promise<{ count: number }> {
  const batch = assertBatch(ids);
  if (batch.length === 0) return { count: 0 };
  const where = { ...(await ownedWhere(kind, batch, userId, db)), deletedAt: { not: null } };
  const data = { deletedAt: null };

  switch (kind) {
    case "poll":
      return db.classroomPoll.updateMany({ where, data });
    case "word_cloud":
      return db.wordCloud.updateMany({ where, data });
    case "board":
      return db.interactiveBoard.updateMany({ where, data });
    case "whiteboard":
      return db.whiteboard.updateMany({ where, data });
  }
}

/** Xoá vĩnh viễn ngay. Chỉ áp cho phiên ĐÃ ở trong thùng rác — không có đường tắt bỏ qua thùng rác. */
export async function deleteQuickActivitiesForever(
  kind: QuickActivityKind,
  ids: string[],
  userId: string,
  db: PrismaClient
): Promise<{ count: number }> {
  const batch = assertBatch(ids);
  if (batch.length === 0) return { count: 0 };
  const where = { ...(await ownedWhere(kind, batch, userId, db)), deletedAt: { not: null } };

  switch (kind) {
    case "poll":
      return db.classroomPoll.deleteMany({ where });
    case "word_cloud":
      return db.wordCloud.deleteMany({ where });
    case "board":
      return db.interactiveBoard.deleteMany({ where });
    case "whiteboard":
      return db.whiteboard.deleteMany({ where });
  }
}

/** Ngày phiên trong thùng rác sẽ bị xoá vĩnh viễn. */
export function trashPurgeDate(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + TRASH_RETENTION_DAYS * DAY_MS);
}

/**
 * Cron: xoá vĩnh viễn mọi phiên đã nằm trong thùng rác quá TRASH_RETENTION_DAYS ngày.
 * Chạy lại an toàn. File đính kèm của Padlet thành file mồ côi và do storage-orphan-sweep dọn.
 */
export async function purgeExpiredQuickActivities(
  db: PrismaClient,
  now: Date = new Date()
): Promise<Record<QuickActivityKind, number>> {
  const where = { deletedAt: { lt: new Date(now.getTime() - TRASH_RETENTION_DAYS * DAY_MS) } };
  const [poll, wordCloud, board, whiteboard] = await Promise.all([
    db.classroomPoll.deleteMany({ where }),
    db.wordCloud.deleteMany({ where }),
    db.interactiveBoard.deleteMany({ where }),
    db.whiteboard.deleteMany({ where }),
  ]);
  return { poll: poll.count, word_cloud: wordCloud.count, board: board.count, whiteboard: whiteboard.count };
}
