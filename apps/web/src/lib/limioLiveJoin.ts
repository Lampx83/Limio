import { prisma } from "@feedbackme/db";
import { normalizeJoinCode } from "@feedbackme/core-lms";

// Trạng thái phiên trình chiếu dành cho HỌC VIÊN (trang /learn/live/[code]). Chỉ trả những
// gì học viên được thấy: câu hỏi + phương án, KHÔNG có cờ đáp án đúng của quiz.
export type LiveJoinSlide =
  | { kind: "poll" | "quiz"; slideId: string; poll: { id: string; question: string; options: string[] } }
  | { kind: "word_cloud"; slideId: string; wordCloud: { id: string; prompt: string } }
  | { kind: "collaborate_board" | "whiteboard"; slideId: string; joinPath: string };

export type LiveJoinState =
  | { status: "not_found" }
  | { status: "ended"; title: string }
  | { status: "waiting"; title: string; identityMode: "anonymous" | "login" }
  | { status: "active"; title: string; identityMode: "anonymous" | "login"; slide: LiveJoinSlide };

// Cả lớp poll cùng lúc (mỗi máy ~1 request / 2s) — gom truy vấn DB trong 1,5s cho mỗi mã phiên.
const CACHE_MS = 1500;
const cache = new Map<string, { at: number; value: LiveJoinState }>();

export async function getLiveJoinState(rawCode: string): Promise<LiveJoinState> {
  const code = normalizeJoinCode(rawCode);
  if (!code) return { status: "not_found" };

  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const value = await loadState(code);
  cache.set(code, { at: Date.now(), value });
  if (cache.size > 500) {
    for (const [k, v] of cache) if (Date.now() - v.at > CACHE_MS) cache.delete(k);
  }
  return value;
}

async function loadState(code: string): Promise<LiveJoinState> {
  const session = await prisma.liveSession.findUnique({
    where: { joinCode: code },
    select: {
      endedAt: true,
      identityMode: true,
      currentSlideId: true,
      slideRuntimeRefs: true,
      deck: { select: { title: true } },
    },
  });
  if (!session) return { status: "not_found" };
  const title = session.deck.title;
  if (session.endedAt) return { status: "ended", title };

  const { identityMode } = session;
  const waiting: LiveJoinState = { status: "waiting", title, identityMode };
  if (!session.currentSlideId) return waiting;

  const slide = await prisma.liveSlide.findUnique({
    where: { id: session.currentSlideId },
    select: { id: true, type: true },
  });
  if (!slide || slide.type === "content") return waiting;

  const refId = (session.slideRuntimeRefs as Record<string, string>)[slide.id];
  if (!refId) return waiting; // slide tương tác nhưng runtime chưa được tạo (giảng viên chưa mở)

  if (slide.type === "poll" || slide.type === "quiz") {
    const poll = await prisma.classroomPoll.findUnique({
      where: { id: refId },
      select: { id: true, question: true, options: true },
    });
    if (!poll) return waiting;
    return { status: "active", title, identityMode, slide: { kind: slide.type, slideId: slide.id, poll } };
  }
  if (slide.type === "word_cloud") {
    const wordCloud = await prisma.wordCloud.findUnique({ where: { id: refId }, select: { id: true, prompt: true } });
    if (!wordCloud) return waiting;
    return { status: "active", title, identityMode, slide: { kind: "word_cloud", slideId: slide.id, wordCloud } };
  }
  if (slide.type === "whiteboard") {
    const wb = await prisma.whiteboard.findUnique({ where: { id: refId }, select: { code: true } });
    if (!wb) return waiting;
    return { status: "active", title, identityMode, slide: { kind: "whiteboard", slideId: slide.id, joinPath: `/whiteboard/${wb.code}` } };
  }
  const board = await prisma.interactiveBoard.findUnique({ where: { id: refId }, select: { code: true } });
  if (!board) return waiting;
  return { status: "active", title, identityMode, slide: { kind: "collaborate_board", slideId: slide.id, joinPath: `/join/${board.code}` } };
}
