"use client";

import { useEffect, useState } from "react";
import { PenTool } from "lucide-react";
import Whiteboard from "./Whiteboard";
import ActivityPlanRunner from "./ActivityPlanRunner";

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
  // Whiteboard cần toàn màn hình (canvas) — không nhét vừa panel nhỏ của
  // drawer như các tool còn lại, nên mở như overlay riêng đè lên trên.
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);

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

  if (whiteboardOpen) {
    return (
      <div className="fixed inset-0 z-[60] bg-white dark:bg-zinc-900">
        <Whiteboard onExit={() => setWhiteboardOpen(false)} />
      </div>
    );
  }

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
          <button
            onClick={() => {
              setWhiteboardOpen(true);
              onClose();
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-teal-50 p-4 text-left transition-colors hover:border-sky-400 dark:border-sky-900/40"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
              <PenTool size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Whiteboard</p>
              <p className="text-xs text-muted">Vẽ tay đồng bộ, toàn màn hình</p>
            </div>
          </button>

          <ActivityPlanRunner
            lessonId={lessonId}
            onOpenWhiteboard={() => {
              setWhiteboardOpen(true);
              onClose();
            }}
          />
        </div>
      </div>
    </>
  );
}
