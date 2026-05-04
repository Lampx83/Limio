"use client";

import { useEffect } from "react";
import RandomPicker from "./RandomPicker";
import QuickPoll from "./QuickPoll";
import WordCloud from "./WordCloud";
import GroupingTool from "./GroupingTool";
import CountdownTimer from "./CountdownTimer";

interface TeachingToolsDrawerProps {
  lessonId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function TeachingToolsDrawer({
  lessonId,
  isOpen,
  onClose,
}: TeachingToolsDrawerProps) {
  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-96 transform bg-white shadow-xl transition-transform duration-300 ease-in-out md:w-80 sm:w-[calc(100%-2rem)] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900">Công cụ Giảng dạy</h2>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg p-2 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-400"
            aria-label="Đóng menu"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="space-y-6 overflow-y-auto p-6" style={{ maxHeight: "calc(100vh - 80px)" }}>
          <RandomPicker lessonId={lessonId} />
          <QuickPoll lessonId={lessonId} />
          <WordCloud lessonId={lessonId} />
          <GroupingTool lessonId={lessonId} />
          <CountdownTimer />
        </div>
      </div>
    </>
  );
}
