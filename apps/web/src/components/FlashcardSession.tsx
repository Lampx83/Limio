"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FlashcardMode, FlashcardRating } from "@feedbackme/shared-types";
import type { QueueCard } from "@feedbackme/core-feedback";
import {
  createReviewSubmitter,
  initSession,
  ratingForKey,
  sessionReducer,
  summarize,
  type ReviewSubmitter,
} from "@/lib/flashcardSession";
import FlashcardStage from "./FlashcardStage";
import FlashcardSummary from "./FlashcardSummary";

/**
 * LANG G4 — một phiên ôn: lật → đánh giá → thẻ kế tiếp → tổng kết.
 *
 * Thẻ kế tiếp hiện NGAY khi đánh giá; việc ghi nhận chạy nền qua hàng đợi có thử lại
 * (createReviewSubmitter), nên mạng chậm không làm khựng học viên. Mỗi lượt mang một
 * `reviewId` riêng và được gửi lại với đúng id đó nếu lỗi — server idempotent.
 */
export default function FlashcardSession({
  courseId,
  slug,
  mode,
  initialCards,
}: {
  courseId: string;
  slug: string;
  mode: FlashcardMode;
  initialCards: QueueCard[];
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(sessionReducer, initialCards, initSession);
  const [saveFailed, setSaveFailed] = useState(false);
  const submitter = useRef<ReviewSubmitter | null>(null);
  submitter.current ??= createReviewSubmitter({ courseId, onFailed: () => setSaveFailed(true) });

  const card = state.status === "playing" ? state.cards[state.index] : undefined;

  function rate(rating: FlashcardRating) {
    if (!card || !state.flipped) return;
    dispatch({ type: "rate", rating });
    submitter.current!.enqueue({ itemId: card.itemId, rating, mode, reviewId: crypto.randomUUID() });
  }

  // Phím tắt: Space lật thẻ, 1–4 chọn mức. Bỏ qua khi đang gõ ở ô nhập.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        dispatch({ type: "flip" });
        return;
      }
      const r = ratingForKey(e.key);
      if (r) rate(r);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Còn lượt ôn chưa gửi mà đóng tab thì nhắc, tránh mất lịch ôn.
  useEffect(() => {
    function onUnload(e: BeforeUnloadEvent) {
      if ((submitter.current?.pending() ?? 0) > 0) e.preventDefault();
    }
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  return (
    <div className="space-y-4">
      {saveFailed && (
        <div className="banner-warning text-sm" role="alert">
          Một số lượt ôn chưa được lưu. Kiểm tra mạng rồi tải lại trang; những thẻ đó sẽ xuất hiện lại.
        </div>
      )}
      {card ? (
        <FlashcardStage
          card={card}
          mode={mode}
          flipped={state.flipped}
          index={state.index}
          total={state.cards.length}
          onFlip={() => dispatch({ type: "flip" })}
          onRate={rate}
        />
      ) : (
        <FlashcardSummary
          slug={slug}
          summary={summarize(state.results)}
          onMore={async () => {
            await submitter.current!.flush();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
