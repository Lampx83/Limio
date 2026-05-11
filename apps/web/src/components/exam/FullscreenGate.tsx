"use client";

import { useEffect, useState } from "react";

/**
 * Initial overlay shown before the learner enters fullscreen, and again if
 * they exit (Esc / OS switch). Browsers require a user gesture to enter
 * fullscreen — we can't auto-enter from useEffect.
 */
export default function FullscreenGate({
  examTitle,
  onEnter,
  required,
}: {
  examTitle: string;
  /** Called right after fullscreen request resolves (success or failure). */
  onEnter: () => void;
  /** When false (e.g. proctoringLevel=none), the gate is bypassed. */
  required: boolean;
}) {
  const [open, setOpen] = useState(required);
  const [exited, setExited] = useState(false);

  useEffect(() => {
    if (!required) return;
    const onFs = () => {
      if (!document.fullscreenElement) {
        setExited(true);
        setOpen(true);
      } else {
        setExited(false);
        setOpen(false);
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [required]);

  if (!open) return null;

  const requestFs = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Some browsers reject silently; close gate anyway so the user can take
      // the exam — incidents already flag exits server-side.
    }
    setOpen(false);
    onEnter();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="max-w-md rounded-lg bg-white p-6 text-center shadow-xl">
        <h2 className="mb-2 text-lg font-semibold">{examTitle}</h2>
        {exited ? (
          <p className="mb-4 text-sm text-red-700">
            Bạn đã thoát chế độ toàn màn hình. Hành vi này đã được ghi nhận.
            Vui lòng quay lại để tiếp tục làm bài.
          </p>
        ) : (
          <p className="mb-4 text-sm text-faint">
            Bài thi yêu cầu chế độ toàn màn hình. Nhấn nút bên dưới để bắt
            đầu. Việc rời tab hoặc thoát chế độ toàn màn hình sẽ được ghi lại.
          </p>
        )}
        <button
          type="button"
          onClick={requestFs}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          {exited ? "Quay lại toàn màn hình" : "Vào toàn màn hình & bắt đầu"}
        </button>
      </div>
    </div>
  );
}
