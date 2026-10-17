import { PrismaClient } from "@feedbackme/db";
import { getOwnedSession } from "./present";

// Map slideId -> id bản ghi runtime (xem LiveSession.slideRuntimeRefs trong schema).
type RefMap = Record<string, string>;

const SESSION_LIST_LIMIT = 100;
const TOP_PHRASE_LIMIT = 30;

function refsOf(session: { slideRuntimeRefs: unknown }): RefMap {
  return (session.slideRuntimeRefs ?? {}) as RefMap;
}

// Chuẩn hoá giống word-cloud/results: gộp cụm trùng nhau không phân biệt hoa/thường và dấu câu bao quanh.
function normalizePhrase(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, "")
    .trim();
}

// snapshot whiteboard: { "<trang>": [element Excalidraw...] } — có nét vẽ khi còn element chưa xoá.
function hasDrawing(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== "object") return false;
  return Object.values(snapshot as Record<string, unknown>).some(
    (els) => Array.isArray(els) && els.some((el) => !(el as { isDeleted?: boolean })?.isDeleted)
  );
}

/**
 * Id mọi bản ghi runtime (poll/word cloud/bảng/whiteboard) mà các lượt trình chiếu của user đã sinh ra.
 * Bảng và whiteboard không có khoá nối với ClassroomSession, nên ẩn chúng khỏi "Hoạt động nhanh" bằng id này.
 */
export async function listLiveRuntimeRefIds(userId: string, db: PrismaClient): Promise<string[]> {
  const sessions = await db.liveSession.findMany({
    where: { userId },
    select: { slideRuntimeRefs: true },
  });
  return sessions.flatMap((s) => Object.values(refsOf(s)));
}

export interface LiveSessionSummary {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  /** Số slide tương tác đã được mở trong lượt này (poll, quiz, word cloud, bảng, whiteboard). */
  interactiveCount: number;
  /** Tổng phiếu + bài nộp + ghi chú của mọi slide trong lượt. */
  responseCount: number;
}

/** Lịch sử các lượt trình chiếu của một bài giảng, mới nhất trước. */
export async function listLiveSessionHistory(
  deckId: string,
  userId: string,
  db: PrismaClient
): Promise<LiveSessionSummary[]> {
  const deck = await db.liveDeck.findUnique({ where: { id: deckId }, select: { userId: true } });
  if (!deck || deck.userId !== userId) {
    throw new Error("Not authorized to view this deck");
  }

  const sessions = await db.liveSession.findMany({
    where: { deckId, userId },
    orderBy: { startedAt: "desc" },
    take: SESSION_LIST_LIMIT,
    select: { id: true, startedAt: true, endedAt: true, slideRuntimeRefs: true },
  });

  // Id runtime là cuid duy nhất giữa các bảng, nên tra một lần cho cả lịch sử và không cần biết loại slide.
  const allIds = sessions.flatMap((s) => Object.values(refsOf(s)));
  const [polls, clouds, boards, whiteboards] = await Promise.all([
    db.classroomPoll.findMany({
      where: { id: { in: allIds } },
      select: { id: true, _count: { select: { votes: true } } },
    }),
    db.wordCloud.findMany({
      where: { id: { in: allIds } },
      select: { id: true, _count: { select: { submissions: true } } },
    }),
    db.interactiveBoard.findMany({
      where: { id: { in: allIds } },
      // Chỉ đếm ghi chú đang hiển thị, khớp với phần chi tiết (ghi chú bị ẩn không được tính).
      select: { id: true, _count: { select: { notes: { where: { hidden: false } } } } },
    }),
    db.whiteboard.findMany({
      where: { id: { in: allIds } },
      select: { id: true, snapshot: true },
    }),
  ]);

  const responses = new Map<string, number>();
  for (const p of polls) responses.set(p.id, p._count.votes);
  for (const c of clouds) responses.set(c.id, c._count.submissions);
  for (const b of boards) responses.set(b.id, b._count.notes);
  // Whiteboard không có số phản hồi riêng: coi là 1 phản hồi nếu bảng đã có ít nhất một nét vẽ.
  for (const w of whiteboards) responses.set(w.id, hasDrawing(w.snapshot) ? 1 : 0);

  return sessions
    .map((s) => {
      const ids = Object.values(refsOf(s));
      return {
        id: s.id,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        interactiveCount: ids.length,
        responseCount: ids.reduce((sum, id) => sum + (responses.get(id) ?? 0), 0),
      };
    })
    // Ẩn lượt đã kết thúc mà không có phản hồi nào (vẫn giữ trong DB, mở bằng link vẫn được).
    // Lượt đang mở luôn hiện để GV không mất phiên đang trình chiếu.
    .filter((s) => s.endedAt === null || s.responseCount > 0);
}

export type LiveSlideResult =
  | {
      slideId: string;
      kind: "poll" | "quiz";
      question: string;
      totalVotes: number;
      options: { text: string; correct: boolean; count: number }[];
      /** Slide đã được sửa sau buổi này: kết quả vẫn theo câu hỏi lúc trình chiếu, nhưng không còn biết đáp án đúng. */
      slideChanged: boolean;
    }
  | {
      slideId: string;
      kind: "word_cloud";
      prompt: string;
      totalSubmissions: number;
      phrases: { phrase: string; count: number }[];
    }
  | {
      slideId: string;
      kind: "collaborate_board";
      title: string;
      prompt: string | null;
      notes: { authorName: string; content: string; column: string | null }[];
    }
  | {
      slideId: string;
      kind: "whiteboard";
      title: string;
      code: string;
    };

export interface LiveSessionResults {
  id: string;
  deckId: string;
  deckTitle: string;
  startedAt: Date;
  endedAt: Date | null;
  slides: LiveSlideResult[];
}

/**
 * Kết quả đầy đủ của một lượt trình chiếu, theo đúng thứ tự slide trong bài giảng.
 * Slide chưa từng được mở trong lượt đó không xuất hiện.
 */
export async function getLiveSessionResults(
  sessionId: string,
  userId: string,
  db: PrismaClient
): Promise<LiveSessionResults> {
  const session = await getOwnedSession(sessionId, userId, db);
  const deck = await db.liveDeck.findUnique({ where: { id: session.deckId }, select: { title: true } });
  const slides = await db.liveSlide.findMany({
    where: { deckId: session.deckId },
    orderBy: { orderIndex: "asc" },
  });
  const refs = refsOf(session);

  const slideResults: LiveSlideResult[] = [];
  for (const slide of slides) {
    const refId = refs[slide.id];
    if (!refId) continue;
    const config = slide.config as Record<string, any>;

    if (slide.type === "poll" || slide.type === "quiz") {
      // Câu hỏi và phương án lấy từ bản ghi poll đã chụp LÚC TRÌNH CHIẾU, không lấy từ slide hiện tại: giảng
      // viên có thể sửa slide sau đó, và phiếu bầu chỉ lưu chỉ số phương án nên đọc theo slide mới sẽ gán
      // phiếu sai phương án (tiêu chí H12: kết quả cũ giữ theo buổi cũ).
      const poll = await db.classroomPoll.findUnique({
        where: { id: refId },
        select: { question: true, options: true, votes: { select: { choice: true } } },
      });
      if (!poll) continue;
      const current: { text: string; correct?: boolean }[] = config.options ?? [];
      const sameOptions =
        current.length === poll.options.length && current.every((o, i) => o.text === poll.options[i]);
      const sameQuestion = (config.question ?? "") === poll.question;
      const counts = poll.options.map(() => 0);
      for (const v of poll.votes) {
        const idx = Number(v.choice);
        if (Number.isInteger(idx) && idx >= 0 && idx < counts.length) counts[idx]! += 1;
      }
      slideResults.push({
        slideId: slide.id,
        kind: slide.type,
        question: poll.question,
        totalVotes: poll.votes.length,
        // Đáp án đúng chỉ tin được khi các phương án của slide vẫn y như lúc trình chiếu.
        options: poll.options.map((text, i) => ({
          text,
          correct: sameOptions ? !!current[i]?.correct : false,
          count: counts[i] ?? 0,
        })),
        slideChanged: !(sameOptions && sameQuestion),
      });
    } else if (slide.type === "word_cloud") {
      const cloud = await db.wordCloud.findUnique({
        where: { id: refId },
        select: { prompt: true, submissions: { select: { text: true } } },
      });
      if (!cloud) continue;
      const freq = new Map<string, number>();
      for (const { text } of cloud.submissions) {
        const phrase = normalizePhrase(text);
        if (phrase.length === 0) continue;
        freq.set(phrase, (freq.get(phrase) ?? 0) + 1);
      }
      const phrases = [...freq.entries()]
        .map(([phrase, count]) => ({ phrase, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, TOP_PHRASE_LIMIT);
      slideResults.push({
        slideId: slide.id,
        kind: "word_cloud",
        prompt: cloud.prompt,
        totalSubmissions: cloud.submissions.length,
        phrases,
      });
    } else if (slide.type === "collaborate_board") {
      const board = await db.interactiveBoard.findUnique({
        where: { id: refId },
        select: {
          title: true,
          prompt: true,
          notes: {
            where: { hidden: false },
            orderBy: { createdAt: "asc" },
            select: { authorName: true, content: true, column: true },
          },
        },
      });
      if (!board) continue;
      slideResults.push({
        slideId: slide.id,
        kind: "collaborate_board",
        title: board.title,
        prompt: board.prompt,
        notes: board.notes,
      });
    } else if (slide.type === "whiteboard") {
      const wb = await db.whiteboard.findUnique({
        where: { id: refId },
        select: { title: true, code: true },
      });
      if (!wb) continue;
      slideResults.push({ slideId: slide.id, kind: "whiteboard", title: wb.title, code: wb.code });
    }
  }

  return {
    id: session.id,
    deckId: session.deckId,
    deckTitle: deck?.title ?? "",
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    slides: slideResults,
  };
}
