import {
  FLASHCARD_RATINGS,
  FLASHCARD_SESSION_LIMIT,
  type FlashcardMode,
  type FlashcardRating,
} from "@feedbackme/shared-types";
import type { QueueCard } from "@feedbackme/core-feedback";
import { apiUrl } from "@/lib/apiUrl";

/**
 * LANG G4 — điều khiển phiên ôn flashcard ở máy khách. Tách khỏi component để thử
 * được không cần trình duyệt: bộ giảm trạng thái (lật → đánh giá → thẻ kế), nhãn
 * khoảng ôn, phím tắt, và hàng đợi gửi lượt ôn chạy nền có thử lại.
 */

export interface SessionResult {
  itemId: string;
  rating: FlashcardRating;
}

export interface SessionState {
  cards: QueueCard[];
  index: number;
  flipped: boolean;
  results: SessionResult[];
  status: "playing" | "done";
}

export type SessionAction = { type: "flip" } | { type: "rate"; rating: FlashcardRating };

export function initSession(cards: QueueCard[]): SessionState {
  return { cards, index: 0, flipped: false, results: [], status: cards.length > 0 ? "playing" : "done" };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  if (state.status === "done") return state;
  if (action.type === "flip") return state.flipped ? state : { ...state, flipped: true };
  // Phải lật thẻ rồi mới đánh giá được (đánh giá khi chưa thấy đáp án là vô nghĩa).
  if (!state.flipped) return state;
  const card = state.cards[state.index]!;
  const results = [...state.results, { itemId: card.itemId, rating: action.rating }];
  const next = state.index + 1;
  return next >= state.cards.length
    ? { ...state, results, flipped: false, status: "done" }
    : { ...state, results, index: next, flipped: false };
}

export function summarize(results: SessionResult[]): { total: number } & Record<FlashcardRating, number> {
  const out = { total: results.length, again: 0, hard: 0, good: 0, easy: 0 };
  for (const r of results) out[r.rating] += 1;
  return out;
}

/** Phím 1–4 ứng với Quên, Khó, Được, Dễ. */
export function ratingForKey(key: string): FlashcardRating | null {
  const i = ["1", "2", "3", "4"].indexOf(key);
  return i < 0 ? null : FLASHCARD_RATINGS[i]!;
}

/** Nhãn khoảng ôn tới trên nút: ngày → tuần → tháng → năm. */
export function formatInterval(days: number): string {
  if (days < 7) return `${days} ngày`;
  if (days < 30) return `${Math.round(days / 7)} tuần`;
  if (days < 365) return `${Math.round(days / 30)} tháng`;
  return "1 năm";
}

/** Số thẻ một phiên hôm nay có thể lấy: đến hạn + thẻ mới còn được ôn, tối đa 20. */
export function reviewableToday(s: { dueToday: number; newAvailable: number }): number {
  return Math.min(FLASHCARD_SESSION_LIMIT, s.dueToday + s.newAvailable);
}

export interface ReviewSubmission {
  itemId: string;
  rating: FlashcardRating;
  mode: FlashcardMode;
  reviewId: string;
}

export interface ReviewSubmitter {
  /** Đưa vào hàng đợi rồi trả về NGAY — thẻ kế tiếp hiện không chờ mạng. */
  enqueue(item: ReviewSubmission): void;
  /** Resolve khi hàng đợi rỗng (đã gửi xong hoặc đã bỏ cuộc). */
  flush(): Promise<void>;
  pending(): number;
}

/**
 * Hàng đợi gửi lượt ôn chạy nền, giữ đúng thứ tự. Lỗi mạng/5xx/429 thử lại với CÙNG
 * `reviewId` (server idempotent nên không tính hai lần); 4xx (sai thẻ, hết quyền) thì
 * không thử lại. Hết số lần thử thì báo `onFailed` và đi tiếp lượt sau.
 */
export function createReviewSubmitter(opts: {
  courseId: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
  onFailed?: (item: ReviewSubmission, status?: number) => void;
}): ReviewSubmitter {
  const doFetch = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxAttempts = opts.maxAttempts ?? 5;
  const queue: ReviewSubmission[] = [];
  let running: Promise<void> | null = null;

  async function send(item: ReviewSubmission): Promise<void> {
    let lastStatus: number | undefined;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await doFetch(apiUrl(`/api/courses/${opts.courseId}/flashcards/review`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
        if (res.ok) return;
        lastStatus = res.status;
        // 4xx (trừ 429) là lỗi của yêu cầu: thử lại cũng vô ích.
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          opts.onFailed?.(item, res.status);
          return;
        }
      } catch {
        lastStatus = undefined;
      }
      if (attempt < maxAttempts - 1) await sleep(500 * 2 ** attempt);
    }
    opts.onFailed?.(item, lastStatus);
  }

  async function drain(): Promise<void> {
    while (queue.length > 0) {
      const item = queue[0]!;
      await send(item);
      queue.shift();
    }
    running = null;
  }

  return {
    enqueue(item) {
      queue.push(item);
      running ??= drain();
    },
    flush: () => running ?? Promise.resolve(),
    pending: () => queue.length,
  };
}
