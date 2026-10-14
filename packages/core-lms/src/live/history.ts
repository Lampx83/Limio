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
  const [polls, clouds, boards] = await Promise.all([
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
  ]);

  const responses = new Map<string, number>();
  for (const p of polls) responses.set(p.id, p._count.votes);
  for (const c of clouds) responses.set(c.id, c._count.submissions);
  for (const b of boards) responses.set(b.id, b._count.notes);

  return sessions.map((s) => {
    const ids = Object.values(refsOf(s));
    return {
      id: s.id,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      interactiveCount: ids.length,
      responseCount: ids.reduce((sum, id) => sum + (responses.get(id) ?? 0), 0),
    };
  });
}

export type LiveSlideResult =
  | {
      slideId: string;
      kind: "poll" | "quiz";
      question: string;
      totalVotes: number;
      options: { text: string; correct: boolean; count: number }[];
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
      const poll = await db.classroomPoll.findUnique({
        where: { id: refId },
        select: { votes: { select: { choice: true } } },
      });
      if (!poll) continue;
      const options: { text: string; correct?: boolean }[] = config.options ?? [];
      const counts = options.map(() => 0);
      for (const v of poll.votes) {
        const idx = Number(v.choice);
        if (Number.isInteger(idx) && idx >= 0 && idx < counts.length) counts[idx]! += 1;
      }
      slideResults.push({
        slideId: slide.id,
        kind: slide.type,
        question: config.question ?? "",
        totalVotes: poll.votes.length,
        options: options.map((o, i) => ({ text: o.text, correct: !!o.correct, count: counts[i] ?? 0 })),
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
