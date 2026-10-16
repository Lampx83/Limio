import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  deleteQuickActivitiesForever,
  moveQuickActivitiesToTrash,
  purgeExpiredQuickActivities,
  restoreQuickActivities,
  TRASH_BATCH_LIMIT,
} from "../quick-activity-trash";

const DAY_MS = 24 * 60 * 60 * 1000;

function uniqueCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function makeUser(tag: string) {
  return prisma.user.create({ data: { email: `${tag}-${uniqueCode()}@example.com`, displayName: tag } });
}

async function makePoll(userId: string) {
  const session = await prisma.classroomSession.create({ data: {} });
  return prisma.classroomPoll.create({
    data: { sessionId: session.id, question: "Q?", options: ["A", "B"], createdById: userId },
  });
}

async function makeBoard(userId: string) {
  return prisma.interactiveBoard.create({ data: { code: uniqueCode(), ownerId: userId, title: "Padlet" } });
}

describe("quick activity trash", () => {
  it("chuyển vào thùng rác rồi khôi phục được, phiếu bầu còn nguyên", async () => {
    const teacher = await makeUser("trash-poll");
    const poll = await makePoll(teacher.id);
    await prisma.classroomPollVote.create({ data: { pollId: poll.id, choice: "0" } });

    const trashed = await moveQuickActivitiesToTrash("poll", [poll.id], teacher.id, prisma);
    expect(trashed.count).toBe(1);
    expect((await prisma.classroomPoll.findUnique({ where: { id: poll.id } }))?.deletedAt).not.toBeNull();

    // Xoá lần hai không đổi mốc thời gian đã có.
    expect((await moveQuickActivitiesToTrash("poll", [poll.id], teacher.id, prisma)).count).toBe(0);

    const restored = await restoreQuickActivities("poll", [poll.id], teacher.id, prisma);
    expect(restored.count).toBe(1);
    const after = await prisma.classroomPoll.findUnique({
      where: { id: poll.id },
      include: { _count: { select: { votes: true } } },
    });
    expect(after?.deletedAt).toBeNull();
    expect(after?._count.votes).toBe(1);
  });

  it("không đụng được phiên của GV khác", async () => {
    const owner = await makeUser("trash-owner");
    const other = await makeUser("trash-other");
    const poll = await makePoll(owner.id);
    const board = await makeBoard(owner.id);

    expect((await moveQuickActivitiesToTrash("poll", [poll.id], other.id, prisma)).count).toBe(0);
    expect((await moveQuickActivitiesToTrash("board", [board.id], other.id, prisma)).count).toBe(0);
    expect((await prisma.interactiveBoard.findUnique({ where: { id: board.id } }))?.deletedAt).toBeNull();
  });

  it("bảng đang mở bị đóng khi vào thùng rác và vẫn đóng sau khi khôi phục", async () => {
    const teacher = await makeUser("trash-board");
    const board = await makeBoard(teacher.id);

    await moveQuickActivitiesToTrash("board", [board.id], teacher.id, prisma);
    const trashed = await prisma.interactiveBoard.findUnique({ where: { id: board.id } });
    expect(trashed?.status).toBe("closed");
    expect(trashed?.closedAt).not.toBeNull();

    await restoreQuickActivities("board", [board.id], teacher.id, prisma);
    const restored = await prisma.interactiveBoard.findUnique({ where: { id: board.id } });
    expect(restored?.deletedAt).toBeNull();
    expect(restored?.status).toBe("closed");
  });

  it("bỏ qua phiên sinh từ Bài giảng tương tác", async () => {
    const teacher = await makeUser("trash-live");
    const deck = await prisma.liveDeck.create({ data: { userId: teacher.id, title: "Bài 1" } });
    const poll = await makePoll(teacher.id);
    const board = await makeBoard(teacher.id);
    await prisma.liveSession.create({
      data: {
        deckId: deck.id,
        userId: teacher.id,
        classroomSessionId: poll.sessionId,
        slideRuntimeRefs: { s1: poll.id, s2: board.id },
      },
    });

    expect((await moveQuickActivitiesToTrash("poll", [poll.id], teacher.id, prisma)).count).toBe(0);
    expect((await moveQuickActivitiesToTrash("board", [board.id], teacher.id, prisma)).count).toBe(0);
  });

  it("xoá vĩnh viễn chỉ áp cho phiên đã ở trong thùng rác", async () => {
    const teacher = await makeUser("trash-forever");
    const live = await makePoll(teacher.id);
    const trashed = await makePoll(teacher.id);
    await moveQuickActivitiesToTrash("poll", [trashed.id], teacher.id, prisma);

    const res = await deleteQuickActivitiesForever("poll", [live.id, trashed.id], teacher.id, prisma);
    expect(res.count).toBe(1);
    expect(await prisma.classroomPoll.findUnique({ where: { id: live.id } })).not.toBeNull();
    expect(await prisma.classroomPoll.findUnique({ where: { id: trashed.id } })).toBeNull();
  });

  it("cron chỉ dọn phiên nằm trong thùng rác quá 30 ngày", async () => {
    const teacher = await makeUser("trash-purge");
    const now = new Date();
    const old = await makePoll(teacher.id);
    const recent = await makePoll(teacher.id);
    const wb = await prisma.whiteboard.create({ data: { code: uniqueCode(), ownerId: teacher.id, title: "Bảng" } });
    await moveQuickActivitiesToTrash("poll", [old.id], teacher.id, prisma, new Date(now.getTime() - 31 * DAY_MS));
    await moveQuickActivitiesToTrash("poll", [recent.id], teacher.id, prisma, new Date(now.getTime() - 29 * DAY_MS));
    await moveQuickActivitiesToTrash("whiteboard", [wb.id], teacher.id, prisma, new Date(now.getTime() - 40 * DAY_MS));

    const res = await purgeExpiredQuickActivities(prisma, now);
    expect(res.poll).toBeGreaterThanOrEqual(1);
    expect(res.whiteboard).toBeGreaterThanOrEqual(1);
    expect(await prisma.classroomPoll.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.classroomPoll.findUnique({ where: { id: recent.id } })).not.toBeNull();
    expect(await prisma.whiteboard.findUnique({ where: { id: wb.id } })).toBeNull();
  });

  it("từ chối lô quá lớn", async () => {
    const teacher = await makeUser("trash-limit");
    const ids = Array.from({ length: TRASH_BATCH_LIMIT + 1 }, (_, i) => `id-${i}`);
    await expect(moveQuickActivitiesToTrash("poll", ids, teacher.id, prisma)).rejects.toThrow();
  });
});
