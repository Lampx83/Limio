import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  ensureSlideJoinCodes,
  pauseLiveSession,
  recordSlideRuntimeRef,
  resetLiveSession,
  resolveSlideJoinCode,
  startOrResumeLiveSession,
} from "../present";

const tag = () => Math.random().toString(36).slice(2, 8);

async function setup() {
  const teacher = await prisma.user.create({ data: { email: `t-${tag()}@example.com`, displayName: "GV" } });
  const deck = await prisma.liveDeck.create({ data: { userId: teacher.id, title: "Bài" } });
  const mk = (type: "content" | "poll" | "word_cloud" | "collaborate_board" | "whiteboard", orderIndex: number, config: object = {}) =>
    prisma.liveSlide.create({ data: { deckId: deck.id, type, orderIndex, config } });
  const content = await mk("content", 0, { title: "Mở đầu" });
  const poll = await mk("poll", 1, { question: "Q?", options: [{ text: "A" }, { text: "B" }] });
  const cloud = await mk("word_cloud", 2, { prompt: "Từ khoá" });
  const session = await startOrResumeLiveSession(deck.id, teacher.id, prisma);
  return { teacher, deck, content, poll, cloud, session };
}

describe("mã tham gia theo từng slide tương tác", () => {
  it("chỉ slide tương tác có mã, mỗi slide một mã khác nhau, gọi lại vẫn là mã cũ", async () => {
    const { teacher, content, poll, cloud, session } = await setup();
    const codes = await ensureSlideJoinCodes(session.id, teacher.id, prisma);
    expect(codes[content.id]).toBeUndefined();
    expect(codes[poll.id]).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    expect(codes[cloud.id]).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    expect(codes[poll.id]).not.toBe(codes[cloud.id]);

    const again = await ensureSlideJoinCodes(session.id, teacher.id, prisma);
    expect(again).toEqual(codes);
  });

  it("mã không trùng mã chung của phiên", async () => {
    const { teacher, poll, session } = await setup();
    const codes = await ensureSlideJoinCodes(session.id, teacher.id, prisma);
    expect(codes[poll.id]).not.toBe(session.joinCode);
  });

  it("người khác không lấy được mã của phiên", async () => {
    const { session } = await setup();
    const other = await prisma.user.create({ data: { email: `o-${tag()}@example.com`, displayName: "GV2" } });
    await expect(ensureSlideJoinCodes(session.id, other.id, prisma)).rejects.toThrow(/Not authorized/);
  });

  it("slide thêm sau cũng nhận mã mà các slide cũ giữ nguyên mã", async () => {
    const { teacher, deck, poll, session } = await setup();
    const before = await ensureSlideJoinCodes(session.id, teacher.id, prisma);
    const added = await prisma.liveSlide.create({
      data: { deckId: deck.id, type: "whiteboard", orderIndex: 9, config: { title: "Bảng" } },
    });
    const after = await ensureSlideJoinCodes(session.id, teacher.id, prisma);
    expect(after[poll.id]).toBe(before[poll.id]);
    expect(after[added.id]).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  });
});

describe("tạm dừng và mở lại phiên tương tác", () => {
  it("thoát màn chiếu thì phiên chỉ tạm dừng, mở lại vẫn đúng phiên cũ với mã cũ", async () => {
    const { teacher, deck, poll, session } = await setup();
    const codes = await ensureSlideJoinCodes(session.id, teacher.id, prisma);

    await pauseLiveSession(session.id, teacher.id, prisma);
    const paused = await prisma.liveSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(paused.pausedAt).not.toBeNull();
    expect(paused.endedAt).toBeNull();

    const resumed = await startOrResumeLiveSession(deck.id, teacher.id, prisma);
    expect(resumed.id).toBe(session.id);
    expect(resumed.pausedAt).toBeNull();
    expect((await ensureSlideJoinCodes(resumed.id, teacher.id, prisma))[poll.id]).toBe(codes[poll.id]);
  });
});

describe("lưu hoặc xoá phiên rồi tạo phiên tương tác mới", () => {
  async function withResults() {
    const ctx = await setup();
    const classroom = await prisma.classroomSession.create({ data: {} });
    await prisma.liveSession.update({ where: { id: ctx.session.id }, data: { classroomSessionId: classroom.id } });
    const pollRt = await prisma.classroomPoll.create({
      data: { sessionId: classroom.id, question: "Q?", options: ["A", "B"], isAnonymous: true, createdById: ctx.teacher.id },
    });
    await prisma.classroomPollVote.createMany({ data: [{ pollId: pollRt.id, choice: "0" }, { pollId: pollRt.id, choice: "1" }] });
    await recordSlideRuntimeRef(ctx.session.id, ctx.teacher.id, ctx.poll.id, pollRt.id, prisma);
    const codes = await ensureSlideJoinCodes(ctx.session.id, ctx.teacher.id, prisma);
    return { ...ctx, pollRt, codes };
  }

  it("lưu: phiên cũ kết thúc nhưng giữ kết quả, phiên mới trống và mã mới", async () => {
    const { teacher, poll, session, pollRt, codes } = await withResults();
    const next = await resetLiveSession(session.id, teacher.id, "save", prisma);

    expect(next.id).not.toBe(session.id);
    expect(next.endedAt).toBeNull();
    expect(next.slideRuntimeRefs).toEqual({});
    const old = await prisma.liveSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(old.endedAt).not.toBeNull();
    expect(await prisma.classroomPollVote.count({ where: { pollId: pollRt.id } })).toBe(2);

    const newCodes = await ensureSlideJoinCodes(next.id, teacher.id, prisma);
    expect(newCodes[poll.id]).not.toBe(codes[poll.id]);
    // mã cũ vẫn còn trong lịch sử nhưng thuộc phiên đã kết thúc
    const oldRow = await prisma.liveSlideCode.findUniqueOrThrow({ where: { code: codes[poll.id]! } });
    expect(oldRow.sessionId).toBe(session.id);
  });

  it("xoá: kết quả và phiên cũ bị xoá, phiên mới trống và mã mới", async () => {
    const { teacher, poll, session, pollRt, codes } = await withResults();
    const next = await resetLiveSession(session.id, teacher.id, "discard", prisma);

    expect(next.id).not.toBe(session.id);
    expect(await prisma.classroomPoll.findUnique({ where: { id: pollRt.id } })).toBeNull();
    expect(await prisma.classroomPollVote.count({ where: { pollId: pollRt.id } })).toBe(0);
    expect(await prisma.liveSession.findUnique({ where: { id: session.id } })).toBeNull();
    expect(await prisma.liveSlideCode.findUnique({ where: { code: codes[poll.id]! } })).toBeNull();
  });

  it("chỉ chủ phiên mới đặt lại được", async () => {
    const { session } = await withResults();
    const other = await prisma.user.create({ data: { email: `o-${tag()}@example.com`, displayName: "GV2" } });
    await expect(resetLiveSession(session.id, other.id, "discard", prisma)).rejects.toThrow(/Not authorized/);
  });
});

describe("học viên quét mã của một slide", () => {
  async function ready() {
    const ctx = await setup();
    const codes = await ensureSlideJoinCodes(ctx.session.id, ctx.teacher.id, prisma);
    const go = (slideId: string) => prisma.liveSession.update({ where: { id: ctx.session.id }, data: { currentSlideId: slideId } });
    return { ...ctx, codes, go };
  }

  it("mã lạ thì không tìm thấy", async () => {
    expect(await resolveSlideJoinCode("ZZZZZZ", prisma)).toEqual({ status: "not_found" });
  });

  it("đang chiếu đúng slide đó nhưng chưa mở thì chờ; đã mở thì vào được", async () => {
    const { teacher, poll, session, codes, go } = await ready();
    await go(poll.id);
    expect((await resolveSlideJoinCode(codes[poll.id]!, prisma)).status).toBe("waiting");

    await recordSlideRuntimeRef(session.id, teacher.id, poll.id, "runtime-1", prisma);
    const open = await resolveSlideJoinCode(codes[poll.id]!, prisma);
    expect(open).toMatchObject({ status: "open", refId: "runtime-1", slide: { id: poll.id, type: "poll" } });
  });

  it("giảng viên chuyển sang slide khác thì điện thoại đã quét báo đã đóng, không theo sang slide mới", async () => {
    const { poll, cloud, codes, go } = await ready();
    await go(cloud.id);
    expect(await resolveSlideJoinCode(codes[poll.id]!, prisma)).toMatchObject({ status: "closed", reason: "moved" });
  });

  it("phiên tạm dừng thì đóng, mở lại thì vào lại được", async () => {
    const { teacher, deck, poll, session, codes, go } = await ready();
    await go(poll.id);
    await recordSlideRuntimeRef(session.id, teacher.id, poll.id, "runtime-1", prisma);
    await pauseLiveSession(session.id, teacher.id, prisma);
    expect(await resolveSlideJoinCode(codes[poll.id]!, prisma)).toMatchObject({ status: "closed", reason: "paused" });

    await startOrResumeLiveSession(deck.id, teacher.id, prisma);
    expect((await resolveSlideJoinCode(codes[poll.id]!, prisma)).status).toBe("open");
  });

  it("sau khi lưu phiên và đặt lại thì mã cũ báo phiên đã kết thúc", async () => {
    const { teacher, poll, session, codes } = await ready();
    await resetLiveSession(session.id, teacher.id, "save", prisma);
    expect(await resolveSlideJoinCode(codes[poll.id]!, prisma)).toMatchObject({ status: "closed", reason: "ended" });
  });

  it("slide bị đổi thành slide nội dung thì mã báo đã đóng", async () => {
    const { poll, codes, go } = await ready();
    await go(poll.id);
    await prisma.liveSlide.update({ where: { id: poll.id }, data: { type: "content" } });
    expect(await resolveSlideJoinCode(codes[poll.id]!, prisma)).toMatchObject({ status: "closed" });
  });
});
