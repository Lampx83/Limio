"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A7.7.3 — Multi-tab detection.
 *
 * When two browser tabs open the same exam attempt, both must know about each
 * other. We use BroadcastChannel (same-origin, same-process: same browser) to
 * announce "I am here". The first tab that hears another tab announce → logs a
 * `multi_tab` incident and shows a warning overlay.
 *
 * Idempotency: each tab has a random `tabId`. We only flag when the announcing
 * tab is different from us. The flag fires at most once per mount.
 */
export default function MultiTabDetector({
  attemptId,
  onConflict,
}: {
  attemptId: string;
  onConflict: (peerTabId: string) => void;
}) {
  const [show, setShow] = useState(false);
  // Giữ callback trong ref. ExamPlayer truyền một hàm MỚI mỗi lần dựng lại (mỗi
  // giây, do đồng hồ đếm ngược); để nó trong dependency thì mỗi giây effect bị
  // gỡ/gắn lại: tabId mới, `flagged` về false, "hello" phát lại — nên khi có tab
  // thứ hai, sự cố multi_tab bị ghi lặp mỗi giây và lớp phủ đỏ hiện lại liên tục.
  const onConflictRef = useRef(onConflict);
  onConflictRef.current = onConflict;

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const tabId = Math.random().toString(36).slice(2, 10);
    const ch = new BroadcastChannel(`exam-attempt:${attemptId}`);
    let flagged = false;

    const onMessage = (ev: MessageEvent) => {
      const peer = ev.data as { tabId?: string; kind?: string } | undefined;
      if (!peer?.tabId || peer.tabId === tabId) return;
      if (peer.kind === "hello") {
        // Reply so the new tab also knows we exist.
        ch.postMessage({ tabId, kind: "ack" });
      }
      if (peer.kind === "hello" || peer.kind === "ack") {
        if (!flagged) {
          flagged = true;
          onConflictRef.current(peer.tabId);
          setShow(true);
        }
      }
    };
    ch.addEventListener("message", onMessage);
    ch.postMessage({ tabId, kind: "hello" });

    return () => {
      ch.removeEventListener("message", onMessage);
      ch.close();
    };
  }, [attemptId]);

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <div className="max-w-md rounded-lg border border-red-300 bg-white p-6 text-center shadow-xl">
        <h2 className="mb-2 text-lg font-semibold text-red-700">
          Cảnh báo: Phát hiện tab khác
        </h2>
        <p className="mb-4 text-sm">
          Hệ thống phát hiện bạn đang mở bài thi này ở một tab khác trong cùng trình duyệt.
          Vui lòng đóng tab kia ngay. Sự việc đã được ghi lại và gửi cho giảng viên.
        </p>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          Tôi đã hiểu, tiếp tục
        </button>
      </div>
    </div>
  );
}
