import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { getLiveSessionResults, listLiveRuntimeRefIds, listLiveSessionHistory } from "../history";

function uniqueCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function makeUser(tag: string) {
  return prisma.user.create({
    data: {
      email: `${tag}-${uniqueCode()}@example.com`,
      displayName: tag,
    },
  });
}

/** Một bài giảng có 3 slide tương tác đã mở trong 1 lượt, và 1 slide chưa mở. */
async function seedRun(teacherId: string) {
  const deck = await prisma.liveDeck.create({ data: { userId: teacherId, title: "Bài 1" } });
  const pollSlide = await prisma.liveSlide.create({
    data: {
      deckId: deck.id,
      type: "poll",
      orderIndex: 1,
      config: { question: "Q?", options: [{ text: "A" }, { text: "B" }] },
    },
  });
  const cloudSlide = await prisma.liveSlide.create({
    data: { deckId: deck.id, type: "word_cloud", orderIndex: 2, config: { prompt: "Từ khoá" } },
  });
  const boardSlide = await prisma.liveSlide.create({
    data: { deckId: deck.id, type: "collaborate_board", orderIndex: 3, config: { title: "Padlet" } },
  });
  await prisma.liveSlide.create({
    data: { deckId: deck.id, type: "word_cloud", orderIndex: 4, config: { prompt: "Chưa mở" } },
  });

  const classroom = await prisma.classroomSession.create({ data: {} });
  const poll = await prisma.classroomPoll.create({
    data: { sessionId: classroom.id, question: "Q?", options: ["A", "B"], isAnonymous: true, createdById: teacherId },
  });
  await prisma.classroomPollVote.createMany({
    data: [
      { pollId: poll.id, choice: "0" },
      { pollId: poll.id, choice: "0" },
      { pollId: poll.id, choice: "1" },
    ],
  });
  const cloud = await prisma.wordCloud.create({
    data: { sessionId: classroom.id, prompt: "Từ khoá", createdById: teacherId },
  });
  await prisma.wordCloudSubmission.createMany({
    data: [
      { cloudId: cloud.id, text: "Hay" },
      { cloudId: cloud.id, text: " hay! " },
      { cloudId: cloud.id, text: "Vui" },
    ],
  });
  const board = await prisma.interactiveBoard.create({
    data: { code: uniqueCode(), ownerId: teacherId, title: "Padlet", columns: [] },
  });
  await prisma.boardNote.createMany({
    data: [
      { boardId: board.id, authorName: "An", content: "ý 1" },
      { boardId: board.id, authorName: "Bình", content: "ẩn", hidden: true },
    ],
  });

  const session = await prisma.liveSession.create({
    data: {
      deckId: deck.id,
      userId: teacherId,
      classroomSessionId: classroom.id,
      slideRuntimeRefs: { [pollSlide.id]: poll.id, [cloudSlide.id]: cloud.id, [boardSlide.id]: board.id },
    },
  });

  return { deck, session, poll, cloud, board, pollSlide, cloudSlide, boardSlide };
}

describe("lịch sử tương tác Limio-Live", () => {
  it("lịch sử lượt trình chiếu đếm đúng số slide và số phản hồi", async () => {
    const teacher = await makeUser("gv");
    const { deck, session } = await seedRun(teacher.id);

    const history = await listLiveSessionHistory(deck.id, teacher.id, prisma);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      id: session.id,
      interactiveCount: 3,
      // 3 phiếu + 3 bài nộp + 1 ghi chú (ghi chú ẩn không tính vào số hiển thị tổng)
      responseCount: 7,
    });
  });

  it("ẩn lượt đã kết thúc không có phản hồi; lượt đang mở vẫn hiện; dữ liệu vẫn còn trong DB", async () => {
    const teacher = await makeUser("gv");
    const deck = await prisma.liveDeck.create({ data: { userId: teacher.id, title: "Trống" } });
    const emptyEnded = await prisma.liveSession.create({
      data: { deckId: deck.id, userId: teacher.id, endedAt: new Date() },
    });
    const emptyOpen = await prisma.liveSession.create({ data: { deckId: deck.id, userId: teacher.id } });

    const history = await listLiveSessionHistory(deck.id, teacher.id, prisma);
    expect(history.map((h) => h.id)).toEqual([emptyOpen.id]);

    const stillInDb = await prisma.liveSession.findUnique({ where: { id: emptyEnded.id } });
    expect(stillInDb).not.toBeNull();
  });

  it("từ chối xem lịch sử bài giảng của người khác", async () => {
    const teacher = await makeUser("gv");
    const other = await makeUser("khac");
    const { deck } = await seedRun(teacher.id);

    await expect(listLiveSessionHistory(deck.id, other.id, prisma)).rejects.toThrow("Not authorized");
  });

  it("kết quả từng slide theo đúng thứ tự bài giảng, bỏ slide chưa mở", async () => {
    const teacher = await makeUser("gv");
    const { session } = await seedRun(teacher.id);

    const results = await getLiveSessionResults(session.id, teacher.id, prisma);
    expect(results.slides.map((s) => s.kind)).toEqual(["poll", "word_cloud", "collaborate_board"]);

    const poll = results.slides[0];
    if (poll?.kind !== "poll") throw new Error("expected poll");
    expect(poll.totalVotes).toBe(3);
    expect(poll.options.map((o) => o.count)).toEqual([2, 1]);

    const cloud = results.slides[1];
    if (cloud?.kind !== "word_cloud") throw new Error("expected word_cloud");
    expect(cloud.totalSubmissions).toBe(3);
    expect(cloud.phrases[0]).toEqual({ phrase: "hay", count: 2 });

    const board = results.slides[2];
    if (board?.kind !== "collaborate_board") throw new Error("expected collaborate_board");
    expect(board.notes.map((n) => n.content)).toEqual(["ý 1"]);
  });

  it("liệt kê id runtime để ẩn khỏi Hoạt động nhanh", async () => {
    const teacher = await makeUser("gv");
    const { poll, cloud, board } = await seedRun(teacher.id);

    const ids = await listLiveRuntimeRefIds(teacher.id, prisma);
    expect(ids).toEqual(expect.arrayContaining([poll.id, cloud.id, board.id]));
  });

  it("bộ lọc Hoạt động nhanh bỏ poll/word cloud thuộc lượt trình chiếu, giữ poll độc lập", async () => {
    const teacher = await makeUser("gv");
    const { poll, cloud } = await seedRun(teacher.id);
    const standalone = await prisma.classroomSession.create({ data: {} });
    const standalonePoll = await prisma.classroomPoll.create({
      data: { sessionId: standalone.id, question: "Lẻ", options: ["x", "y"], isAnonymous: true, createdById: teacher.id },
    });

    const visiblePolls = await prisma.classroomPoll.findMany({
      where: { createdById: teacher.id, session: { liveSessions: { none: {} } } },
      select: { id: true },
    });
    const visibleClouds = await prisma.wordCloud.findMany({
      where: { createdById: teacher.id, session: { liveSessions: { none: {} } } },
      select: { id: true },
    });

    expect(visiblePolls.map((p) => p.id)).toEqual([standalonePoll.id]);
    expect(visibleClouds).toEqual([]);
    expect(poll.id).not.toBe(standalonePoll.id);
    expect(cloud.id).toBeTruthy();
  });
});
