"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lộ dần một đoạn text theo nhịp CỐ ĐỊNH thay vì hiện ngay khi có — dùng cho
 * lời AI trong phòng vấn đáp. Cả hai chế độ đều cần: giọng nói (voice-turn)
 * trả nguyên câu một lúc (không có gì để "stream"), chữ (SSE) bung theo cụm
 * token của OpenAI chứ không đều — bung nhanh chậm thất thường tự nó đã
 * giống "hiện nhanh quá" dù có stream. `push` chỉ NÂNG mục tiêu — gọi lại
 * với cùng hoặc dài hơn base cũ đều an toàn (SSE nối dần từng delta).
 */
export function usePacedReveal(charsPerSec = 45) {
  const [revealed, setRevealed] = useState("");
  const targetRef = useRef("");
  const shownRef = useRef(0);

  useEffect(() => {
    const intervalMs = 30;
    const perTick = Math.max(1, Math.round((charsPerSec * intervalMs) / 1000));
    const t = setInterval(() => {
      if (shownRef.current >= targetRef.current.length) return;
      shownRef.current = Math.min(targetRef.current.length, shownRef.current + perTick);
      setRevealed(targetRef.current.slice(0, shownRef.current));
    }, intervalMs);
    return () => clearInterval(t);
  }, [charsPerSec]);

  return {
    /** Text đã lộ ra tới thời điểm hiện tại — hiện cái này, không hiện target. */
    revealed,
    /** true khi đã lộ hết target hiện tại — dùng để biết lúc nào chốt vào lịch sử. */
    isDone: () => shownRef.current >= targetRef.current.length,
    /** Nâng mục tiêu lộ tới `text`. An toàn gọi nhiều lần (SSE nối từng delta). */
    push(text: string) {
      targetRef.current = text;
    },
    /** Hiện hết ngay phần đã nhận — sinh viên chạm vào lời AI để khỏi chờ chữ chạy. */
    skip() {
      shownRef.current = targetRef.current.length;
      setRevealed(targetRef.current);
    },
    /** Reset về rỗng — gọi khi bắt đầu một lượt AI mới. */
    reset() {
      targetRef.current = "";
      shownRef.current = 0;
      setRevealed("");
    },
  };
}
