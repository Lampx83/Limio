import { prisma } from "@feedbackme/db";
import { normalizeJoinCode, resolveSlideJoinCode } from "@feedbackme/core-lms";

// Trạng thái phiên trình chiếu dành cho HỌC VIÊN (trang /learn/live/[code]). Chỉ trả những
// gì học viên được thấy: câu hỏi + phương án, KHÔNG có cờ đáp án đúng của quiz.
export type LiveJoinSlide =
  | { kind: "poll" | "quiz"; slideId: string; poll: { id: string; question: string; options: string[] } }
  | { kind: "word_cloud"; slideId: string; wordCloud: { id: string; prompt: string } }
  | { kind: "collaborate_board" | "whiteboard"; slideId: string; joinPath: string };

export type LiveJoinState =
  | { status: "not_found" }
  | { status: "ended"; title: string }
  | { status: "waiting"; title: string; identityMode: "anonymous" | "login"; scope?: "slide" }
  // Mã của một slide mà giảng viên đã chuyển đi, tạm dừng hoặc kết thúc phiên: học viên không trả lời được nữa.
  | { status: "closed"; title: string; identityMode: "anonymous" | "login"; reason: "ended" | "paused" | "moved" }
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
      pausedAt: true,
      identityMode: true,
      currentSlideId: true,
      slideRuntimeRefs: true,
      deck: { select: { title: true } },
    },
  });
  // Mã không phải mã phiên thì là mã của từng slide tương tác (cách tham gia chính).
  if (!session) return loadSlideCodeState(code);
  const title = session.deck.title;
  if (session.endedAt) return { status: "ended", title };

  const { identityMode } = session;
  const waiting: LiveJoinState = { status: "waiting", title, identityMode };
  // Phiên đang tạm dừng (giảng viên thoát màn chiếu): chưa có câu hỏi nào để trả lời.
  if (!session.currentSlideId || session.pausedAt) return waiting;

  const slide = await prisma.liveSlide.findUnique({
    where: { id: session.currentSlideId },
    select: { id: true, type: true },
  });
  if (!slide || slide.type === "content") return waiting;

  const refId = (session.slideRuntimeRefs as Record<string, string>)[slide.id];
  if (!refId) return waiting; // slide tương tác nhưng runtime chưa được tạo (giảng viên chưa mở)

  return describeActiveSlide(title, identityMode, { id: slide.id, type: slide.type }, refId, waiting);
}

async function loadSlideCodeState(code: string): Promise<LiveJoinState> {
  const target = await resolveSlideJoinCode(code, prisma);
  if (target.status === "not_found") return { status: "not_found" };
  if (target.status === "closed") return { status: "closed", title: target.title, identityMode: target.identityMode, reason: target.reason };
  const waiting: LiveJoinState = { status: "waiting", title: target.title, identityMode: target.identityMode, scope: "slide" };
  if (target.status === "waiting") return waiting;
  return describeActiveSlide(target.title, target.identityMode, target.slide, target.refId, waiting);
}

// Dựng phần câu hỏi cho học viên từ bản ghi runtime của slide (không lộ đáp án đúng).
async function describeActiveSlide(
  title: string,
  identityMode: "anonymous" | "login",
  slide: { id: string; type: string },
  refId: string,
  waiting: LiveJoinState
): Promise<LiveJoinState> {
  if (slide.type === "poll" || slide.type === "quiz") {
    const poll = await prisma.classroomPoll.findUnique({
      where: { id: refId },
      select: { id: true, question: true, options: true },
    });
    if (!poll) return waiting;
    return { status: "active", title, identityMode, slide: { kind: slide.type as "poll" | "quiz", slideId: slide.id, poll } };
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
